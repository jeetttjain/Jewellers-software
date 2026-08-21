import { getDatabase } from '../db/connection.js';
import * as schema from '../db/schema/index.js';
import { eq, and, desc, gte, lte } from 'drizzle-orm';
import { Decimal } from 'decimal.js';

export async function getSupplierLedger(
  shopId: string,
  supplierId: string,
  startDate?: string,
  endDate?: string
) {
  const { db } = await getDatabase();

  const supplier = await db
    .select()
    .from(schema.suppliers)
    .where(and(eq(schema.suppliers.id, supplierId), eq(schema.suppliers.shopId, shopId)))
    .limit(1);

  if (supplier.length === 0) {
    throw new Error('Supplier not found.');
  }

  const conditions = [
    eq(schema.supplierLedgerEntries.shopId, shopId),
    eq(schema.supplierLedgerEntries.supplierId, supplierId)
  ];

  if (startDate) {
    conditions.push(gte(schema.supplierLedgerEntries.date, new Date(startDate)));
  }
  if (endDate) {
    conditions.push(lte(schema.supplierLedgerEntries.date, new Date(endDate)));
  }

  const entries = await db
    .select()
    .from(schema.supplierLedgerEntries)
    .where(and(...conditions))
    .orderBy(desc(schema.supplierLedgerEntries.date));

  // Compute summary totals
  let totalPurchases = new Decimal(0);
  let totalPayments = new Decimal(0);
  let totalReturns = new Decimal(0);

  entries.forEach((e: typeof schema.supplierLedgerEntries.$inferSelect) => {
    if (e.type === 'PURCHASE_BILL') {
      totalPurchases = totalPurchases.plus(new Decimal(e.credit));
    } else if (e.type === 'PAYMENT_OUT') {
      totalPayments = totalPayments.plus(new Decimal(e.debit));
    } else if (e.type === 'PURCHASE_RETURN') {
      totalReturns = totalReturns.plus(new Decimal(e.debit));
    }
  });

  return {
    supplier: supplier[0],
    summary: {
      openingBalance: supplier[0].openingBalance,
      totalPurchases: totalPurchases.toFixed(2),
      totalPayments: totalPayments.toFixed(2),
      totalReturns: totalReturns.toFixed(2),
      currentOutstanding: supplier[0].currentBalance
    },
    entries
  };
}
