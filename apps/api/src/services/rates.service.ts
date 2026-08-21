import { getDatabase } from '../db/connection.js';
import * as schema from '../db/schema/index.js';
import { Decimal } from 'decimal.js';
import { eq, and, desc, asc, sql } from 'drizzle-orm';
import { RateDefinition, RateHistoryEntry } from '@jewellery-pos/shared';

export interface CreateRateDefinitionInput {
  metal: string;
  purity: string;
  fineness: number;
  currentRate: string;
  isActive?: boolean;
  sortOrder?: number;
}

export interface UpdateRateDefinitionInput {
  currentRate?: string;
  isActive?: boolean;
  sortOrder?: number;
  changeReason?: string;
}

export interface CreateRatesInput {
  rate24k: string;
  rate22k: string;
  rate18k: string;
  rateSilver: string;
  ratePlatinum?: string;
}

// Standard Initial Rate Definitions for New / Empty Showrooms
const DEFAULT_STANDARD_DEFINITIONS = [
  { metal: 'GOLD', purity: '24K', fineness: 999, currentRate: '7450.00', sortOrder: 1 },
  { metal: 'GOLD', purity: '22K', fineness: 916, currentRate: '6980.00', sortOrder: 2 },
  { metal: 'GOLD', purity: '18K', fineness: 750, currentRate: '5720.00', sortOrder: 3 },
  { metal: 'GOLD', purity: '14K', fineness: 585, currentRate: '4450.00', sortOrder: 4 },
  { metal: 'SILVER', purity: '999', fineness: 999, currentRate: '88.50', sortOrder: 5 },
  { metal: 'SILVER', purity: '925', fineness: 925, currentRate: '82.00', sortOrder: 6 },
  { metal: 'PLATINUM', purity: '950', fineness: 950, currentRate: '3150.00', sortOrder: 7 }
];

/**
 * Ensures default showroom rate definitions exist for the given shop.
 * Seeds initial records safely without creating duplicates.
 */
export async function ensureDefaultRateDefinitions(shopId: string) {
  const { db } = await getDatabase();
  const existing = await db
    .select()
    .from(schema.rateDefinitions)
    .where(eq(schema.rateDefinitions.shopId, shopId))
    .limit(1);

  if (existing.length === 0) {
    for (const item of DEFAULT_STANDARD_DEFINITIONS) {
      try {
        await db.insert(schema.rateDefinitions).values({
          shopId,
          metal: item.metal,
          purity: item.purity,
          fineness: item.fineness,
          currentRate: item.currentRate,
          isActive: true,
          sortOrder: item.sortOrder
        });
      } catch {
        // Ignore if created concurrently
      }
    }
  }
}

/**
 * Retrieves all Rate Master definitions for a showroom.
 */
export async function getRateDefinitions(shopId: string, includeInactive = true): Promise<RateDefinition[]> {
  await ensureDefaultRateDefinitions(shopId);
  const { db } = await getDatabase();

  let query = db
    .select()
    .from(schema.rateDefinitions)
    .where(
      includeInactive
        ? eq(schema.rateDefinitions.shopId, shopId)
        : and(eq(schema.rateDefinitions.shopId, shopId), eq(schema.rateDefinitions.isActive, true))
    )
    .orderBy(asc(schema.rateDefinitions.sortOrder), asc(schema.rateDefinitions.metal), asc(schema.rateDefinitions.purity));

  const rows = await query;
  return rows.map((r: any) => ({
    id: r.id,
    shopId: r.shopId,
    metal: r.metal,
    purity: r.purity,
    fineness: r.fineness,
    currentRate: r.currentRate,
    isActive: r.isActive,
    sortOrder: r.sortOrder,
    effectiveFrom: r.effectiveFrom?.toISOString ? r.effectiveFrom.toISOString() : String(r.effectiveFrom),
    createdAt: r.createdAt?.toISOString ? r.createdAt.toISOString() : String(r.createdAt),
    updatedAt: r.updatedAt?.toISOString ? r.updatedAt.toISOString() : String(r.updatedAt)
  }));
}

/**
 * Adds a new custom metal/purity rate definition.
 * Prevents duplicate active metal + purity / fineness combinations per shop.
 */
export async function createRateDefinition(
  shopId: string,
  input: CreateRateDefinitionInput,
  userId: string,
  userName: string
): Promise<RateDefinition> {
  const { db } = await getDatabase();
  await ensureDefaultRateDefinitions(shopId);

  const cleanMetal = input.metal.trim().toUpperCase();
  const cleanPurity = input.purity.trim().toUpperCase();
  const fineness = Math.round(Number(input.fineness));
  const currentRate = new Decimal(input.currentRate).toFixed(2);

  if (new Decimal(currentRate).isNegative()) {
    throw new Error('Rate cannot be negative');
  }
  if (!fineness || fineness < 1 || fineness > 1000) {
    throw new Error('Fineness must be an integer between 1 and 1000');
  }

  // Duplicate Check: Check if duplicate metal+purity or metal+fineness exists
  const existing = await db
    .select()
    .from(schema.rateDefinitions)
    .where(
      and(
        eq(schema.rateDefinitions.shopId, shopId),
        sql`UPPER(${schema.rateDefinitions.metal}) = ${cleanMetal}`,
        sql`(UPPER(${schema.rateDefinitions.purity}) = ${cleanPurity} OR ${schema.rateDefinitions.fineness} = ${fineness})`
      )
    );

  if (existing.length > 0) {
    const error: any = new Error(`This purity (${cleanPurity} / ${fineness}) already exists for ${cleanMetal}.`);
    error.statusCode = 409;
    error.code = 'DUPLICATE_PURITY';
    throw error;
  }

  const [inserted] = await db
    .insert(schema.rateDefinitions)
    .values({
      shopId,
      metal: cleanMetal,
      purity: cleanPurity,
      fineness,
      currentRate,
      isActive: input.isActive ?? true,
      sortOrder: input.sortOrder ?? 0
    })
    .returning();

  // Log to Rate History (Immutable Rate Master change log)
  await db.insert(schema.rateHistory).values({
    shopId,
    rateDefinitionId: inserted.id,
    metal: cleanMetal,
    purity: cleanPurity,
    fineness,
    previousRate: null,
    newRate: currentRate,
    action: 'RATE_CREATED',
    changedBy: userId,
    changedByName: userName
  });

  // Log to Audit Logs
  await db.insert(schema.auditLogs).values({
    shopId,
    actorId: userId,
    actorName: userName,
    actorRole: 'ADMIN',
    action: 'RATE_CREATED',
    entityName: 'RATE_DEFINITION',
    entityId: inserted.id,
    stateDiff: {
      metal: cleanMetal,
      purity: cleanPurity,
      fineness,
      currentRate,
      isActive: inserted.isActive
    }
  });

  return {
    id: inserted.id,
    shopId: inserted.shopId,
    metal: inserted.metal,
    purity: inserted.purity,
    fineness: inserted.fineness,
    currentRate: inserted.currentRate,
    isActive: inserted.isActive,
    sortOrder: inserted.sortOrder,
    effectiveFrom: inserted.effectiveFrom?.toISOString ? inserted.effectiveFrom.toISOString() : String(inserted.effectiveFrom),
    createdAt: inserted.createdAt?.toISOString ? inserted.createdAt.toISOString() : String(inserted.createdAt),
    updatedAt: inserted.updatedAt?.toISOString ? inserted.updatedAt.toISOString() : String(inserted.updatedAt)
  };
}

/**
 * Updates a rate definition.
 * Enforces IMMUTABILITY of identity fields (metal, purity, fineness).
 */
export async function updateRateDefinition(
  shopId: string,
  id: string,
  input: UpdateRateDefinitionInput,
  userId: string,
  userName: string
): Promise<RateDefinition> {
  const { db } = await getDatabase();

  const existingRows = await db
    .select()
    .from(schema.rateDefinitions)
    .where(and(eq(schema.rateDefinitions.shopId, shopId), eq(schema.rateDefinitions.id, id)))
    .limit(1);

  if (existingRows.length === 0) {
    const error: any = new Error('Rate definition not found.');
    error.statusCode = 404;
    throw error;
  }

  const existing = existingRows[0];
  const updateData: any = { updatedAt: new Date() };
  let rateChanged = false;
  let statusChanged = false;

  if (input.currentRate !== undefined) {
    const newRate = new Decimal(input.currentRate).toFixed(2);
    if (new Decimal(newRate).isNegative()) {
      throw new Error('Rate cannot be negative');
    }
    if (newRate !== existing.currentRate) {
      updateData.currentRate = newRate;
      updateData.effectiveFrom = new Date();
      rateChanged = true;
    }
  }

  if (input.isActive !== undefined && input.isActive !== existing.isActive) {
    updateData.isActive = input.isActive;
    statusChanged = true;
  }

  if (input.sortOrder !== undefined) {
    updateData.sortOrder = input.sortOrder;
  }

  const [updated] = await db
    .update(schema.rateDefinitions)
    .set(updateData)
    .where(and(eq(schema.rateDefinitions.shopId, shopId), eq(schema.rateDefinitions.id, id)))
    .returning();

  // Rate History Log for Rate Update
  if (rateChanged) {
    await db.insert(schema.rateHistory).values({
      shopId,
      rateDefinitionId: updated.id,
      metal: updated.metal,
      purity: updated.purity,
      fineness: updated.fineness,
      previousRate: existing.currentRate,
      newRate: updated.currentRate,
      action: 'RATE_UPDATED',
      changedBy: userId,
      changedByName: userName,
      changeReason: input.changeReason || null
    });
  }

  // Rate History Log for Status Change
  if (statusChanged) {
    await db.insert(schema.rateHistory).values({
      shopId,
      rateDefinitionId: updated.id,
      metal: updated.metal,
      purity: updated.purity,
      fineness: updated.fineness,
      previousRate: existing.currentRate,
      newRate: updated.currentRate,
      action: updated.isActive ? 'RATE_ACTIVATED' : 'RATE_DEACTIVATED',
      changedBy: userId,
      changedByName: userName,
      changeReason: input.changeReason || null
    });
  }

  // Audit Log
  await db.insert(schema.auditLogs).values({
    shopId,
    actorId: userId,
    actorName: userName,
    actorRole: 'ADMIN',
    action: rateChanged ? 'RATE_UPDATED' : statusChanged ? (updated.isActive ? 'RATE_ACTIVATED' : 'RATE_DEACTIVATED') : 'RATE_UPDATED',
    entityName: 'RATE_DEFINITION',
    entityId: updated.id,
    stateDiff: {
      previousRate: existing.currentRate,
      newRate: updated.currentRate,
      previousStatus: existing.isActive,
      newStatus: updated.isActive,
      changeReason: input.changeReason || null
    }
  });

  return {
    id: updated.id,
    shopId: updated.shopId,
    metal: updated.metal,
    purity: updated.purity,
    fineness: updated.fineness,
    currentRate: updated.currentRate,
    isActive: updated.isActive,
    sortOrder: updated.sortOrder,
    effectiveFrom: updated.effectiveFrom?.toISOString ? updated.effectiveFrom.toISOString() : String(updated.effectiveFrom),
    createdAt: updated.createdAt?.toISOString ? updated.createdAt.toISOString() : String(updated.createdAt),
    updatedAt: updated.updatedAt?.toISOString ? updated.updatedAt.toISOString() : String(updated.updatedAt)
  };
}

/**
 * Bulk Publishes Today's Showroom Rates across all active definitions.
 * Updates rate_definitions as the single source of truth, logs to rate_history,
 * and maintains gold_rates archive for legacy backward-compatibility.
 */
export async function publishDailyRates(
  shopId: string,
  ratesList: { id: string; rate: string }[],
  userId: string,
  userName: string,
  changeReason?: string
) {
  const { db } = await getDatabase();
  const updatedDefinitions: RateDefinition[] = [];

  for (const item of ratesList) {
    const updated = await updateRateDefinition(
      shopId,
      item.id,
      { currentRate: item.rate, changeReason },
      userId,
      userName
    );
    updatedDefinitions.push(updated);
  }

  // Also write legacy snapshot copy to gold_rates for backward compatibility
  const activeRates = await getRateDefinitions(shopId, false);
  const rate24k = activeRates.find((r) => r.metal === 'GOLD' && r.purity.includes('24'))?.currentRate || '7450.00';
  const rate22k = activeRates.find((r) => r.metal === 'GOLD' && r.purity.includes('22'))?.currentRate || '6980.00';
  const rate18k = activeRates.find((r) => r.metal === 'GOLD' && r.purity.includes('18'))?.currentRate || '5720.00';
  const rateSilver = activeRates.find((r) => r.metal === 'SILVER' && r.purity.includes('999'))?.currentRate || '88.50';
  const ratePlatinum = activeRates.find((r) => r.metal === 'PLATINUM')?.currentRate || '3150.00';

  await db.insert(schema.goldRates).values({
    shopId,
    rate24k,
    rate22k,
    rate18k,
    rateSilver,
    ratePlatinum,
    createdBy: userId,
    createdByName: userName
  });

  return updatedDefinitions;
}

/**
 * Centralized, Deterministic Rate Resolution Engine
 * Resolves the applicable master rate strictly from configured, active rate_definitions.
 * Throws explicit descriptive error if the requested rate is not configured.
 */
export async function resolveCurrentRate(
  shopId: string,
  criteria: {
    rateDefinitionId?: string | null;
    metal?: string;
    purity?: string;
    fineness?: number | null;
  }
): Promise<{
  rateDefinitionId: string;
  metal: string;
  purity: string;
  fineness: number;
  rate: string;
}> {
  await ensureDefaultRateDefinitions(shopId);
  const { db } = await getDatabase();

  // 1. Direct lookup by rateDefinitionId (Highest precedence)
  if (criteria.rateDefinitionId) {
    const rows = await db
      .select()
      .from(schema.rateDefinitions)
      .where(and(eq(schema.rateDefinitions.shopId, shopId), eq(schema.rateDefinitions.id, criteria.rateDefinitionId)))
      .limit(1);

    if (rows.length > 0) {
      const def = rows[0];
      if (!def.isActive) {
        throw new Error(`Rate definition for ${def.metal} ${def.purity} is currently deactivated.`);
      }
      return {
        rateDefinitionId: def.id,
        metal: def.metal,
        purity: def.purity,
        fineness: def.fineness,
        rate: def.currentRate
      };
    }
  }

  // 2. Deterministic lookup by (shopId, metal, purity / fineness)
  const metal = (criteria.metal || 'GOLD').trim().toUpperCase();
  const purity = (criteria.purity || '').trim().toUpperCase();
  const fineness = criteria.fineness ? Math.round(Number(criteria.fineness)) : null;

  const activeDefinitions = await db
    .select()
    .from(schema.rateDefinitions)
    .where(and(eq(schema.rateDefinitions.shopId, shopId), eq(schema.rateDefinitions.isActive, true)));

  // Try exact match on (metal + purity) or (metal + fineness)
  let matched = activeDefinitions.find(
    (d: any) =>
      d.metal.toUpperCase() === metal &&
      (d.purity.toUpperCase() === purity || (fineness && d.fineness === fineness))
  );

  // Partial Karat match if purity contains standard marker (e.g., '22K 916' -> '22K')
  if (!matched && purity) {
    matched = activeDefinitions.find(
      (d: any) =>
        d.metal.toUpperCase() === metal &&
        (purity.startsWith(d.purity.toUpperCase()) || d.purity.toUpperCase().startsWith(purity))
    );
  }

  if (!matched) {
    throw new Error(
      `Rate definition is not configured or inactive for ${metal} ${purity || (fineness ? fineness + ' fineness' : '')}. Please configure this rate in Rate Master.`
    );
  }

  return {
    rateDefinitionId: matched.id,
    metal: matched.metal,
    purity: matched.purity,
    fineness: matched.fineness,
    rate: matched.currentRate
  };
}

export interface RateHistoryFilters {
  metal?: string;
  purity?: string;
  fromDate?: string;
  toDate?: string;
}

export interface HistoricalRateCriteria {
  metal: string;
  purity?: string;
  fineness?: number | null;
  asOfDate: string | Date;
}

/**
 * Retrieves the full immutable Rate History log with optional filtering.
 */
export async function getRatesHistory(
  shopId: string,
  filters?: RateHistoryFilters
): Promise<RateHistoryEntry[]> {
  const { db } = await getDatabase();

  const conditions = [eq(schema.rateHistory.shopId, shopId)];

  if (filters?.metal && filters.metal !== 'ALL') {
    conditions.push(sql`UPPER(${schema.rateHistory.metal}) = ${filters.metal.trim().toUpperCase()}`);
  }

  if (filters?.purity && filters.purity !== 'ALL') {
    conditions.push(sql`UPPER(${schema.rateHistory.purity}) = ${filters.purity.trim().toUpperCase()}`);
  }

  if (filters?.fromDate) {
    const fromDateObj = new Date(filters.fromDate);
    if (!isNaN(fromDateObj.getTime())) {
      conditions.push(sql`${schema.rateHistory.effectiveFrom} >= ${fromDateObj}`);
    }
  }

  if (filters?.toDate) {
    const toDateObj = new Date(filters.toDate);
    if (!isNaN(toDateObj.getTime())) {
      // Set to end of day if only date is passed
      toDateObj.setHours(23, 59, 59, 999);
      conditions.push(sql`${schema.rateHistory.effectiveFrom} <= ${toDateObj}`);
    }
  }

  const rows = await db
    .select()
    .from(schema.rateHistory)
    .where(and(...conditions))
    .orderBy(desc(schema.rateHistory.effectiveFrom), desc(schema.rateHistory.createdAt));

  return rows.map((r: any) => ({
    id: r.id,
    shopId: r.shopId,
    rateDefinitionId: r.rateDefinitionId,
    metal: r.metal,
    purity: r.purity,
    fineness: r.fineness,
    previousRate: r.previousRate,
    newRate: r.newRate,
    action: r.action,
    changedBy: r.changedBy,
    changedByName: r.changedByName,
    changeReason: r.changeReason || null,
    effectiveFrom: r.effectiveFrom?.toISOString ? r.effectiveFrom.toISOString() : String(r.effectiveFrom),
    createdAt: r.createdAt?.toISOString ? r.createdAt.toISOString() : String(r.createdAt)
  }));
}

/**
 * Historical Rate Lookup Engine (As-of Date & Time Query)
 * Returns the exact rate that was active in the showroom at a specific moment in the past.
 * If multiple changes occurred on that day, timestamp ordering determines the exact active rate.
 */
export async function getHistoricalRate(
  shopId: string,
  criteria: HistoricalRateCriteria
): Promise<{
  metal: string;
  purity: string;
  fineness?: number | null;
  rate: string;
  effectiveFrom: string;
  asOfDate: string;
  changedByName?: string | null;
  action?: string;
  changeReason?: string | null;
  isExactHistoricalMatch: boolean;
}> {
  const { db } = await getDatabase();
  const targetDate = new Date(criteria.asOfDate);
  if (isNaN(targetDate.getTime())) {
    throw new Error(`Invalid asOfDate timestamp: '${criteria.asOfDate}'`);
  }

  const cleanMetal = criteria.metal.trim().toUpperCase();
  const cleanPurity = criteria.purity ? criteria.purity.trim().toUpperCase() : '';
  const fineness = criteria.fineness ? Math.round(Number(criteria.fineness)) : null;

  // 1. Find the latest rateHistory record created or effective before/at targetDate
  const historyConditions = [
    eq(schema.rateHistory.shopId, shopId),
    sql`UPPER(${schema.rateHistory.metal}) = ${cleanMetal}`,
    sql`${schema.rateHistory.effectiveFrom} <= ${targetDate}`
  ];

  if (cleanPurity) {
    historyConditions.push(sql`(UPPER(${schema.rateHistory.purity}) = ${cleanPurity} OR ${schema.rateHistory.fineness} = ${fineness})`);
  } else if (fineness) {
    historyConditions.push(eq(schema.rateHistory.fineness, fineness));
  }

  const historyRows = await db
    .select()
    .from(schema.rateHistory)
    .where(and(...historyConditions))
    .orderBy(desc(schema.rateHistory.effectiveFrom), desc(schema.rateHistory.createdAt))
    .limit(1);

  if (historyRows.length > 0) {
    const rec = historyRows[0];
    return {
      metal: rec.metal,
      purity: rec.purity,
      fineness: rec.fineness,
      rate: rec.newRate,
      effectiveFrom: rec.effectiveFrom?.toISOString ? rec.effectiveFrom.toISOString() : String(rec.effectiveFrom),
      asOfDate: targetDate.toISOString(),
      changedByName: rec.changedByName,
      action: rec.action,
      changeReason: rec.changeReason,
      isExactHistoricalMatch: true
    };
  }

  // 2. Fallback: If query date is before any logged history, lookup earliest rate or current active definition
  const current = await resolveCurrentRate(shopId, {
    metal: cleanMetal,
    purity: cleanPurity,
    fineness
  });

  return {
    metal: current.metal,
    purity: current.purity,
    fineness: current.fineness,
    rate: current.rate,
    effectiveFrom: targetDate.toISOString(),
    asOfDate: targetDate.toISOString(),
    isExactHistoricalMatch: false
  };
}

/**
 * Backward compatibility: getLatestRates
 * Derives current rates from the single authoritative source (rate_definitions).
 */
export async function getLatestRates(shopId: string) {
  const active = await getRateDefinitions(shopId, false);
  const rate24k = active.find((r) => r.metal === 'GOLD' && r.purity.includes('24'))?.currentRate || '7450.00';
  const rate22k = active.find((r) => r.metal === 'GOLD' && r.purity.includes('22'))?.currentRate || '6980.00';
  const rate18k = active.find((r) => r.metal === 'GOLD' && r.purity.includes('18'))?.currentRate || '5720.00';
  const rateSilver = active.find((r) => r.metal === 'SILVER' && r.purity.includes('999'))?.currentRate || '88.50';
  const ratePlatinum = active.find((r) => r.metal === 'PLATINUM')?.currentRate || '3150.00';

  return {
    id: 'rate-master-current',
    shopId,
    rate24k,
    rate22k,
    rate18k,
    rateSilver,
    ratePlatinum,
    definitions: active,
    effectiveFrom: new Date(),
    createdBy: '00000000-0000-0000-0000-000000000010',
    createdByName: 'Kamal Kishore Soni',
    createdAt: new Date()
  };
}

/**
 * Backward compatibility: createRatesSnapshot
 */
export async function createRatesSnapshot(
  shopId: string,
  input: CreateRatesInput,
  userId: string,
  userName: string
) {
  const active = await getRateDefinitions(shopId, true);
  const updates: { id: string; rate: string }[] = [];

  const def24k = active.find((r) => r.metal === 'GOLD' && r.purity.includes('24'));
  if (def24k) updates.push({ id: def24k.id, rate: input.rate24k });

  const def22k = active.find((r) => r.metal === 'GOLD' && r.purity.includes('22'));
  if (def22k) updates.push({ id: def22k.id, rate: input.rate22k });

  const def18k = active.find((r) => r.metal === 'GOLD' && r.purity.includes('18'));
  if (def18k) updates.push({ id: def18k.id, rate: input.rate18k });

  const defSilver = active.find((r) => r.metal === 'SILVER' && r.purity.includes('999'));
  if (defSilver) updates.push({ id: defSilver.id, rate: input.rateSilver });

  if (input.ratePlatinum) {
    const defPlat = active.find((r) => r.metal === 'PLATINUM');
    if (defPlat) updates.push({ id: defPlat.id, rate: input.ratePlatinum });
  }

  await publishDailyRates(shopId, updates, userId, userName);
  return getLatestRates(shopId);
}
