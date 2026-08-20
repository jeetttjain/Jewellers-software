import { getDatabase } from '../db/connection.js';
import * as schema from '../db/schema/index.js';
import { Decimal } from 'decimal.js';
import { eq, and, desc, sql } from 'drizzle-orm';

export interface CreateOldGoldInput {
  customerId?: string;
  customerName: string;
  customerMobile: string;
  metal: 'GOLD' | 'SILVER' | 'PLATINUM';
  grossWeight: string;
  dustStoneDeduction?: string;
  testedPurityPercent: string;
  buybackRatePerGram: string;
  settlementType?: 'CART_EXCHANGE' | 'CASH_PAYOUT';
  notes?: string;
}

export async function listOldGoldTransactions(shopId: string) {
  const { db } = await getDatabase();
  return db
    .select()
    .from(schema.oldGoldTransactions)
    .where(eq(schema.oldGoldTransactions.shopId, shopId))
    .orderBy(desc(schema.oldGoldTransactions.createdAt));
}

export async function getOldGoldById(shopId: string, id: string) {
  const { db } = await getDatabase();
  const rows = await db
    .select()
    .from(schema.oldGoldTransactions)
    .where(and(eq(schema.oldGoldTransactions.id, id), eq(schema.oldGoldTransactions.shopId, shopId)))
    .limit(1);

  if (rows.length === 0) {
    throw new Error('Old gold transaction voucher not found');
  }
  return rows[0];
}

export async function createOldGoldAssay(
  shopId: string,
  input: CreateOldGoldInput,
  userId?: string,
  userName?: string
) {
  const { db } = await getDatabase();

  let effectiveUserId = userId;
  let effectiveUserName = userName || 'Staff Assayer';

  if (!effectiveUserId) {
    const shopUsers = await db.select().from(schema.users).where(eq(schema.users.shopId, shopId)).limit(1);
    effectiveUserId = shopUsers[0]?.id || '00000000-0000-0000-0000-000000000010';
    effectiveUserName = shopUsers[0]?.name || effectiveUserName;
  }

  const gross = new Decimal(input.grossWeight);
  const dust = new Decimal(input.dustStoneDeduction || '0.000');
  const netScrap = gross.minus(dust).toDecimalPlaces(3, Decimal.ROUND_HALF_UP);

  if (netScrap.lessThanOrEqualTo(0)) {
    throw new Error('Net scrap gold weight must be greater than zero.');
  }

  const purity = new Decimal(input.testedPurityPercent);
  if (purity.lessThanOrEqualTo(0) || purity.greaterThan(100)) {
    throw new Error('Tested purity percentage must be between 0.01% and 100.00%.');
  }

  // Calculate 24K equivalent fine weight (e.g. 10.000g @ 75.00% = 7.500g 24K fine)
  const fineWeight = netScrap.times(purity.dividedBy(100)).toDecimalPlaces(3, Decimal.ROUND_HALF_UP);

  const buybackRate = new Decimal(input.buybackRatePerGram);
  const totalValuation = fineWeight.times(buybackRate).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

  const countRes = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.oldGoldTransactions)
    .where(eq(schema.oldGoldTransactions.shopId, shopId));
  const seq = (Number(countRes[0]?.count || 0) + 101).toString().padStart(5, '0');
  const transactionNumber = `OG-2026/${seq}`;

  const [inserted] = await db
    .insert(schema.oldGoldTransactions)
    .values({
      shopId,
      transactionNumber,
      customerId: input.customerId || null,
      customerName: input.customerName.trim(),
      customerMobile: input.customerMobile.trim(),
      metal: input.metal,
      grossWeight: gross.toFixed(3),
      dustStoneDeduction: dust.toFixed(3),
      netScrapWeight: netScrap.toFixed(3),
      testedPurityPercent: purity.toFixed(2),
      fineWeight: fineWeight.toFixed(3),
      buybackRatePerGram: buybackRate.toFixed(2),
      totalValuation: totalValuation.toFixed(2),
      settlementType: input.settlementType || 'CART_EXCHANGE',
      createdBy: effectiveUserId,
      notes: input.notes || null
    })
    .returning();

  // Audit Log Entry
  await db.insert(schema.auditLogs).values({
    shopId,
    actorId: effectiveUserId,
    actorName: effectiveUserName,
    actorRole: 'ASSAYER',
    action: 'OLD_GOLD_ASSAY_CREATED',
    entityName: 'OLD_GOLD_TRANSACTION',
    entityId: inserted.id,
    stateDiff: {
      transactionNumber,
      netScrapWeight: netScrap.toFixed(3),
      fineWeight: fineWeight.toFixed(3),
      totalValuation: totalValuation.toFixed(2)
    }
  });

  return inserted;
}
