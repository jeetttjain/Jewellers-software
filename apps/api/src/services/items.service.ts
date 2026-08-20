import { getDatabase } from '../db/connection.js';
import * as schema from '../db/schema/index.js';
import { Decimal } from 'decimal.js';
import { eq, and, desc, sql } from 'drizzle-orm';

import { resolveCurrentRate } from './rates.service.js';

export interface CreateItemInput {
  itemCode: string;
  category: string;
  designTitle: string;
  metal: 'GOLD' | 'SILVER' | 'PLATINUM' | string;
  purity: string;
  fineness?: number | null;
  rateDefinitionId?: string | null;
  grossWeight: string;
  stoneWeight?: string;
  huid?: string;
  hallmarkVerified?: boolean;
  makingChargeType?: 'PER_GRAM' | 'PERCENTAGE' | 'FLAT';
  makingChargeValue?: string;
  wastagePct?: string;
  stoneValue?: string;
  notes?: string;
}

export async function listItems(shopId: string, filterStatus?: string, search?: string) {
  const { db } = await getDatabase();

  let query = db
    .select()
    .from(schema.jewelleryItems)
    .where(eq(schema.jewelleryItems.shopId, shopId))
    .orderBy(desc(schema.jewelleryItems.createdAt));

  const items = await query;

  return items.filter((item: typeof schema.jewelleryItems.$inferSelect) => {
    if (filterStatus && filterStatus !== 'ALL' && item.status !== filterStatus) {
      return false;
    }
    if (search) {
      const q = search.toLowerCase();
      const matchCode = item.itemCode.toLowerCase().includes(q);
      const matchTitle = item.designTitle.toLowerCase().includes(q);
      const matchHuid = item.huid ? item.huid.toLowerCase().includes(q) : false;
      if (!matchCode && !matchTitle && !matchHuid) return false;
    }
    return true;
  });
}

export async function getItemByIdOrCode(shopId: string, idOrCode: string) {
  const { db } = await getDatabase();

  const clean = idOrCode.replace(/^pos:\/\/t\//, '').trim();
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clean);

  let foundItem: any = null;

  if (isUuid) {
    const byId = await db
      .select()
      .from(schema.jewelleryItems)
      .where(and(eq(schema.jewelleryItems.shopId, shopId), eq(schema.jewelleryItems.id, clean)))
      .limit(1);
    if (byId.length > 0) foundItem = byId[0];
  }

  if (!foundItem) {
    // Exact or uppercase match by itemCode
    const byCode = await db
      .select()
      .from(schema.jewelleryItems)
      .where(
        and(
          eq(schema.jewelleryItems.shopId, shopId),
          sql`LOWER(${schema.jewelleryItems.itemCode}) = LOWER(${clean})`
        )
      )
      .limit(1);
    if (byCode.length > 0) foundItem = byCode[0];
  }

  if (!foundItem) {
    // Case-insensitive match by HUID
    const byHuid = await db
      .select()
      .from(schema.jewelleryItems)
      .where(
        and(
          eq(schema.jewelleryItems.shopId, shopId),
          sql`LOWER(${schema.jewelleryItems.huid}) = LOWER(${clean})`
        )
      )
      .limit(1);
    if (byHuid.length > 0) foundItem = byHuid[0];
  }

  if (!foundItem) return null;

  // Fetch multiple item images for full detail / zoom view
  const imgRows = await db
    .select()
    .from(schema.itemImages)
    .where(and(eq(schema.itemImages.shopId, shopId), eq(schema.itemImages.itemId, foundItem.id)))
    .orderBy(desc(schema.itemImages.isPrimary), schema.itemImages.sortOrder);

  const images = imgRows.map((r: any) => ({
    id: r.id,
    shopId: r.shopId,
    itemId: r.itemId,
    storagePath: r.storagePath,
    imageUrl: r.imageUrl,
    isPrimary: r.isPrimary,
    label: r.label,
    sortOrder: r.sortOrder,
    createdAt: new Date(r.createdAt).toISOString(),
    updatedAt: r.updatedAt ? new Date(r.updatedAt).toISOString() : undefined
  }));

  return {
    ...foundItem,
    images
  };
}

export async function createItem(shopId: string, input: CreateItemInput, _userId?: string) {
  const { db } = await getDatabase();

  // Validate unique item code
  const existing = await db
    .select()
    .from(schema.jewelleryItems)
    .where(eq(schema.jewelleryItems.itemCode, input.itemCode.trim()))
    .limit(1);

  if (existing.length > 0) {
    throw new Error(`Item with serial code '${input.itemCode}' already exists in inventory.`);
  }

  // Weight Decimal precision calculation
  const gross = new Decimal(input.grossWeight);
  const stone = new Decimal(input.stoneWeight || '0.000');
  const net = gross.minus(stone).toDecimalPlaces(3, Decimal.ROUND_HALF_UP);

  if (net.lessThan(0)) {
    throw new Error('Net metal weight cannot be negative (gross weight must exceed stone weight).');
  }

  let resolvedDefId = input.rateDefinitionId || null;
  let resolvedFineness = input.fineness ? Math.round(Number(input.fineness)) : null;

  try {
    const resolvedRate = await resolveCurrentRate(shopId, {
      rateDefinitionId: input.rateDefinitionId,
      metal: input.metal,
      purity: input.purity,
      fineness: input.fineness
    });
    resolvedDefId = resolvedRate.rateDefinitionId;
    resolvedFineness = resolvedRate.fineness;
  } catch {
    // If rate definition is not configured, still permit item record creation with fallback
  }

  const [inserted] = await db
    .insert(schema.jewelleryItems)
    .values({
      shopId,
      rateDefinitionId: resolvedDefId,
      itemCode: input.itemCode.trim().toUpperCase(),
      category: input.category,
      designTitle: input.designTitle.trim(),
      metal: input.metal,
      purity: input.purity,
      fineness: resolvedFineness,
      grossWeight: gross.toFixed(3),
      stoneWeight: stone.toFixed(3),
      netWeight: net.toFixed(3),
      huid: input.huid ? input.huid.trim().toUpperCase() : null,
      hallmarkVerified: input.hallmarkVerified ?? true,
      makingChargeType: input.makingChargeType || 'PER_GRAM',
      makingChargeValue: new Decimal(input.makingChargeValue || '0.00').toFixed(2),
      wastagePct: new Decimal(input.wastagePct || '0.00').toFixed(2),
      stoneValue: new Decimal(input.stoneValue || '0.00').toFixed(2),
      status: 'IN_STOCK',
      notes: input.notes || null
    })
    .returning();

  return inserted;
}

export async function updateItem(
  shopId: string,
  itemId: string,
  updates: Partial<CreateItemInput> & { status?: 'IN_STOCK' | 'SOLD' | 'RETURNED_TO_VAULT' | 'MELTED' }
) {
  const { db } = await getDatabase();

  const existing = await db
    .select()
    .from(schema.jewelleryItems)
    .where(and(eq(schema.jewelleryItems.id, itemId), eq(schema.jewelleryItems.shopId, shopId)))
    .limit(1);

  if (existing.length === 0) {
    throw new Error('Item not found');
  }

  // Strict Barcode Identity Immutability Guardrail
  if ((updates as any).itemCode && (updates as any).itemCode.trim().toUpperCase() !== existing[0].itemCode.toUpperCase()) {
    throw new Error('Barcode identity is permanently immutable and cannot be modified.');
  }

  if ((updates as any).id && (updates as any).id !== existing[0].id) {
    throw new Error('Internal item identifier (id) is permanently immutable and cannot be modified.');
  }

  const payload: any = { updatedAt: new Date() };

  if (updates.designTitle) payload.designTitle = updates.designTitle.trim();
  if (updates.category) payload.category = updates.category;
  if (updates.metal) payload.metal = updates.metal;
  if (updates.purity) payload.purity = updates.purity;
  if (updates.status) payload.status = updates.status;
  if (updates.huid !== undefined) payload.huid = updates.huid ? updates.huid.trim().toUpperCase() : null;
  if (updates.notes !== undefined) payload.notes = updates.notes;

  if (updates.grossWeight || updates.stoneWeight) {
    const gross = new Decimal(updates.grossWeight || existing[0].grossWeight);
    const stone = new Decimal(updates.stoneWeight || existing[0].stoneWeight);
    const net = gross.minus(stone).toDecimalPlaces(3, Decimal.ROUND_HALF_UP);
    payload.grossWeight = gross.toFixed(3);
    payload.stoneWeight = stone.toFixed(3);
    payload.netWeight = net.toFixed(3);
  }

  if (updates.makingChargeType) payload.makingChargeType = updates.makingChargeType;
  if (updates.makingChargeValue) payload.makingChargeValue = new Decimal(updates.makingChargeValue).toFixed(2);
  if (updates.wastagePct) payload.wastagePct = new Decimal(updates.wastagePct).toFixed(2);
  if (updates.stoneValue) payload.stoneValue = new Decimal(updates.stoneValue).toFixed(2);

  const [updated] = await db
    .update(schema.jewelleryItems)
    .set(payload)
    .where(eq(schema.jewelleryItems.id, itemId))
    .returning();

  return updated;
}
