import { getDatabase } from '../db/connection.js';
import * as schema from '../db/schema/index.js';
import { eq, and, desc, sql } from 'drizzle-orm';
import { Decimal } from 'decimal.js';

export interface CreateSupplierInput {
  name: string;
  supplierCode: string;
  mobile: string;
  email?: string | null;
  pan?: string | null;
  gstin?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  stateCode?: string | null;
  paymentTermsDays?: number;
  openingBalance?: string;
  notes?: string | null;
}

export async function listSuppliers(shopId: string, search?: string, filterActive?: boolean) {
  const { db } = await getDatabase();

  const suppliersList = await db
    .select()
    .from(schema.suppliers)
    .where(eq(schema.suppliers.shopId, shopId))
    .orderBy(desc(schema.suppliers.createdAt));

  return suppliersList.filter((s: typeof schema.suppliers.$inferSelect) => {
    if (filterActive !== undefined && s.isActive !== filterActive) {
      return false;
    }
    if (search) {
      const q = search.toLowerCase().trim();
      const matchName = s.name.toLowerCase().includes(q);
      const matchCode = s.supplierCode.toLowerCase().includes(q);
      const matchMobile = s.mobile.toLowerCase().includes(q);
      const matchGstin = s.gstin ? s.gstin.toLowerCase().includes(q) : false;
      const matchPan = s.pan ? s.pan.toLowerCase().includes(q) : false;
      if (!matchName && !matchCode && !matchMobile && !matchGstin && !matchPan) {
        return false;
      }
    }
    return true;
  });
}

export async function getSupplierById(shopId: string, id: string) {
  const { db } = await getDatabase();

  const rows = await db
    .select()
    .from(schema.suppliers)
    .where(and(eq(schema.suppliers.id, id), eq(schema.suppliers.shopId, shopId)))
    .limit(1);

  return rows.length > 0 ? rows[0] : null;
}

export async function createSupplier(
  shopId: string,
  input: CreateSupplierInput,
  userId: string,
  userName: string,
  ipAddress?: string
) {
  const { db } = await getDatabase();

  // Validate unique supplierCode within shop
  const existingCode = await db
    .select()
    .from(schema.suppliers)
    .where(
      and(
        eq(schema.suppliers.shopId, shopId),
        sql`LOWER(${schema.suppliers.supplierCode}) = LOWER(${input.supplierCode.trim()})`
      )
    )
    .limit(1);

  if (existingCode.length > 0) {
    throw new Error(`Supplier with code '${input.supplierCode}' already exists in this showroom.`);
  }

  // Validate unique mobile within shop
  const existingMobile = await db
    .select()
    .from(schema.suppliers)
    .where(and(eq(schema.suppliers.shopId, shopId), eq(schema.suppliers.mobile, input.mobile.trim())))
    .limit(1);

  if (existingMobile.length > 0) {
    throw new Error(`Supplier with mobile number '${input.mobile}' already exists.`);
  }

  const openingBal = new Decimal(input.openingBalance || '0.00');

  const [inserted] = await db
    .insert(schema.suppliers)
    .values({
      shopId,
      name: input.name.trim(),
      supplierCode: input.supplierCode.trim().toUpperCase(),
      mobile: input.mobile.trim(),
      email: input.email ? input.email.trim().toLowerCase() : null,
      pan: input.pan ? input.pan.trim().toUpperCase() : null,
      gstin: input.gstin ? input.gstin.trim().toUpperCase() : null,
      address: input.address ? input.address.trim() : null,
      city: input.city ? input.city.trim() : null,
      state: input.state ? input.state.trim() : null,
      stateCode: input.stateCode ? input.stateCode.trim() : null,
      paymentTermsDays: input.paymentTermsDays !== undefined ? input.paymentTermsDays : 30,
      openingBalance: openingBal.toFixed(2),
      currentBalance: openingBal.toFixed(2), // Initial balance equals opening balance
      isActive: true,
      notes: input.notes ? input.notes.trim() : null
    })
    .returning();

  // If opening balance > 0, post initial ledger entry
  if (openingBal.greaterThan(0)) {
    await db.insert(schema.supplierLedgerEntries).values({
      shopId,
      supplierId: inserted.id,
      type: 'OPENING_BALANCE',
      referenceNo: `OB-${inserted.supplierCode}`,
      description: 'Opening balance liability setup',
      credit: openingBal.toFixed(2),
      debit: '0.00',
      runningBalance: openingBal.toFixed(2)
    });
  }

  // Audit log
  await db.insert(schema.auditLogs).values({
    shopId,
    actorId: userId,
    actorName: userName,
    actorRole: 'STAFF',
    action: 'SUPPLIER_CREATED',
    entityName: 'SUPPLIER',
    entityId: inserted.id,
    stateDiff: {
      name: inserted.name,
      supplierCode: inserted.supplierCode,
      mobile: inserted.mobile,
      gstin: inserted.gstin,
      openingBalance: inserted.openingBalance
    },
    ipAddress: ipAddress || null
  });

  return inserted;
}

export async function updateSupplier(
  shopId: string,
  id: string,
  updates: Partial<CreateSupplierInput> & { isActive?: boolean },
  userId: string,
  userName: string,
  ipAddress?: string
) {
  const { db } = await getDatabase();

  const existing = await getSupplierById(shopId, id);
  if (!existing) {
    throw new Error('Supplier not found.');
  }

  // Mobile uniqueness check if changing
  if (updates.mobile && updates.mobile.trim() !== existing.mobile) {
    const duplicate = await db
      .select()
      .from(schema.suppliers)
      .where(and(eq(schema.suppliers.shopId, shopId), eq(schema.suppliers.mobile, updates.mobile.trim())))
      .limit(1);

    if (duplicate.length > 0) {
      throw new Error(`Supplier with mobile number '${updates.mobile}' already exists.`);
    }
  }

  const payload: any = { updatedAt: new Date() };

  if (updates.name !== undefined) payload.name = updates.name.trim();
  if (updates.mobile !== undefined) payload.mobile = updates.mobile.trim();
  if (updates.email !== undefined) payload.email = updates.email ? updates.email.trim().toLowerCase() : null;
  if (updates.pan !== undefined) payload.pan = updates.pan ? updates.pan.trim().toUpperCase() : null;
  if (updates.gstin !== undefined) payload.gstin = updates.gstin ? updates.gstin.trim().toUpperCase() : null;
  if (updates.address !== undefined) payload.address = updates.address ? updates.address.trim() : null;
  if (updates.city !== undefined) payload.city = updates.city ? updates.city.trim() : null;
  if (updates.state !== undefined) payload.state = updates.state ? updates.state.trim() : null;
  if (updates.stateCode !== undefined) payload.stateCode = updates.stateCode ? updates.stateCode.trim() : null;
  if (updates.paymentTermsDays !== undefined) payload.paymentTermsDays = updates.paymentTermsDays;
  if (updates.isActive !== undefined) payload.isActive = updates.isActive;
  if (updates.notes !== undefined) payload.notes = updates.notes ? updates.notes.trim() : null;

  const [updated] = await db
    .update(schema.suppliers)
    .set(payload)
    .where(and(eq(schema.suppliers.id, id), eq(schema.suppliers.shopId, shopId)))
    .returning();

  // Audit log
  await db.insert(schema.auditLogs).values({
    shopId,
    actorId: userId,
    actorName: userName,
    actorRole: 'STAFF',
    action: 'SUPPLIER_UPDATED',
    entityName: 'SUPPLIER',
    entityId: id,
    stateDiff: payload,
    ipAddress: ipAddress || null
  });

  return updated;
}

export async function deleteSupplier(
  shopId: string,
  id: string,
  userId: string,
  userName: string,
  ipAddress?: string
) {
  const { db } = await getDatabase();

  const existing = await getSupplierById(shopId, id);
  if (!existing) {
    throw new Error('Supplier not found.');
  }

  // Check if supplier has purchases
  const purchaseCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.purchases)
    .where(and(eq(schema.purchases.shopId, shopId), eq(schema.purchases.supplierId, id)));

  if (Number(purchaseCount[0]?.count || 0) > 0) {
    // Soft delete / deactivate
    const [deactivated] = await db
      .update(schema.suppliers)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(schema.suppliers.id, id))
      .returning();

    await db.insert(schema.auditLogs).values({
      shopId,
      actorId: userId,
      actorName: userName,
      actorRole: 'STAFF',
      action: 'SUPPLIER_DEACTIVATED',
      entityName: 'SUPPLIER',
      entityId: id,
      stateDiff: { reason: 'Supplier has transaction history; deactivated instead of deleted.' },
      ipAddress: ipAddress || null
    });

    return { deleted: false, deactivated: true, supplier: deactivated };
  }

  // Hard delete if no purchases
  await db.delete(schema.suppliers).where(eq(schema.suppliers.id, id));

  await db.insert(schema.auditLogs).values({
    shopId,
    actorId: userId,
    actorName: userName,
    actorRole: 'STAFF',
    action: 'SUPPLIER_DELETED',
    entityName: 'SUPPLIER',
    entityId: id,
    stateDiff: { supplierCode: existing.supplierCode, name: existing.name },
    ipAddress: ipAddress || null
  });

  return { deleted: true, deactivated: false };
}
