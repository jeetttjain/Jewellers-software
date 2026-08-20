import { getDatabase } from '../db/connection.js';
import * as schema from '../db/schema/index.js';
import {
  DEFAULT_LABEL_CONFIG,
  LabelPreset,
  LabelTemplateConfig
} from '@jewellery-pos/shared';
import { eq, and } from 'drizzle-orm';

export interface UpdateLabelTemplateInput {
  name?: string;
  preset?: LabelPreset;
  widthMm?: string;
  heightMm?: string;
  config: LabelTemplateConfig;
}

/**
 * Retrieves the active label design template for a shop.
 * Creates and persists standard default template if none exists yet.
 */
export async function getLabelTemplate(shopId: string) {
  const { db } = await getDatabase();

  const existing = await db
    .select()
    .from(schema.labelTemplates)
    .where(and(eq(schema.labelTemplates.shopId, shopId), eq(schema.labelTemplates.isDefault, true)))
    .limit(1);

  if (existing.length > 0) {
    return existing[0];
  }

  // Auto-initialize standard default template
  const [created] = await db
    .insert(schema.labelTemplates)
    .values({
      shopId,
      name: 'Standard Jewellery Tag (50x25mm)',
      preset: 'SMALL_RECTANGLE',
      widthMm: '50.00',
      heightMm: '25.00',
      config: DEFAULT_LABEL_CONFIG,
      isDefault: true
    })
    .returning();

  return created;
}

/**
 * Updates the visual label template with strict role-based access control and audit trail.
 * NOTE: Modifying visual layout NEVER alters underlying item barcode identities.
 */
export async function updateLabelTemplate(
  shopId: string,
  input: UpdateLabelTemplateInput,
  actorId: string,
  actorName: string,
  actorRole: string
) {
  const { db } = await getDatabase();

  // Role Authorization check
  const allowedRoles = ['ADMIN', 'OWNER', 'MANAGER'];
  if (!allowedRoles.includes(actorRole.toUpperCase())) {
    throw new Error('Forbidden: Only Admin, Owner, or authorized Manager can customize label templates.');
  }

  const currentTemplate = await getLabelTemplate(shopId);

  const prevConfig = currentTemplate.config;
  const prevPreset = currentTemplate.preset;

  const [updated] = await db
    .update(schema.labelTemplates)
    .set({
      name: input.name ? input.name.trim() : currentTemplate.name,
      preset: input.preset || currentTemplate.preset,
      widthMm: input.widthMm || currentTemplate.widthMm,
      heightMm: input.heightMm || currentTemplate.heightMm,
      config: input.config,
      updatedBy: actorId,
      updatedAt: new Date()
    })
    .where(eq(schema.labelTemplates.id, currentTemplate.id))
    .returning();

  // Write immutable audit trail record
  await db.insert(schema.auditLogs).values({
    shopId,
    actorId,
    actorName,
    actorRole,
    action: 'LABEL_TEMPLATE_UPDATED',
    entityName: 'LABEL_TEMPLATE',
    entityId: updated.id,
    stateDiff: {
      previousPreset: prevPreset,
      newPreset: updated.preset,
      previousDimensions: { width: currentTemplate.widthMm, height: currentTemplate.heightMm },
      newDimensions: { width: updated.widthMm, height: updated.heightMm },
      previousConfig: prevConfig,
      newConfig: updated.config
    }
  });

  return updated;
}

/**
 * Resets the label template back to factory default configuration.
 */
export async function resetLabelTemplate(
  shopId: string,
  actorId: string,
  actorName: string,
  actorRole: string
) {
  return updateLabelTemplate(
    shopId,
    {
      name: 'Standard Jewellery Tag (50x25mm)',
      preset: 'SMALL_RECTANGLE',
      widthMm: '50.00',
      heightMm: '25.00',
      config: DEFAULT_LABEL_CONFIG
    },
    actorId,
    actorName,
    actorRole
  );
}

/**
 * Generates dummy test label data for the designer live preview and test prints.
 * Guarantees zero side-effects on real showroom inventory.
 */
export async function getTestLabelData(shopId: string) {
  const { db } = await getDatabase();
  const shopRows = await db.select().from(schema.shops).where(eq(schema.shops.id, shopId)).limit(1);
  const shop = shopRows[0] || { name: 'KAMAL JEWELLERS', gstin: '27AAAAA0000A1Z5', phone: '+91 98200 12345' };

  return {
    shop: {
      name: shop.name,
      gstin: shop.gstin,
      phone: shop.phone,
      logoUrl: '/assets/logo.png'
    },
    testItem: {
      id: '00000000-0000-0000-0000-000000000099',
      itemCode: 'DEMO-JWL-TEST01',
      category: 'Rings',
      designTitle: '22K Gold Diamond Solitaire Ring',
      metal: 'GOLD',
      purity: '22K 916',
      grossWeight: '5.230',
      stoneWeight: '0.110',
      netWeight: '5.120',
      huid: 'AB1234',
      status: 'IN_STOCK'
    }
  };
}
