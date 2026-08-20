import { getDatabase } from '../db/connection.js';
import * as schema from '../db/schema/index.js';
import { getLatestRates } from './rates.service.js';
import { Decimal } from 'decimal.js';
import { eq, and, desc } from 'drizzle-orm';

export async function getDashboardData(shopId: string) {
  const { db } = await getDatabase();

  const latestRates = await getLatestRates(shopId);

  // 1. Fetch Invoices for Today Sales
  const allInvoices = await db
    .select()
    .from(schema.invoices)
    .where(eq(schema.invoices.shopId, shopId))
    .orderBy(desc(schema.invoices.createdAt));

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  let todaySales = new Decimal(0);
  let todayBillsCount = 0;

  for (const inv of allInvoices) {
    if (new Date(inv.createdAt).getTime() >= startOfDay) {
      todaySales = todaySales.plus(new Decimal(inv.grandTotal));
      todayBillsCount++;
    }
  }

  // 2. Fetch Active Vault Inventory
  const activeItems = await db
    .select()
    .from(schema.jewelleryItems)
    .where(and(eq(schema.jewelleryItems.shopId, shopId), eq(schema.jewelleryItems.status, 'IN_STOCK')));

  let totalVaultWeight = new Decimal(0);
  for (const item of activeItems) {
    totalVaultWeight = totalVaultWeight.plus(new Decimal(item.netWeight));
  }

  // 3. Fetch Customer Outstanding Dues
  const customersList = await db
    .select()
    .from(schema.customers)
    .where(eq(schema.customers.shopId, shopId));

  let totalCustomerDues = new Decimal(0);
  for (const c of customersList) {
    const bal = new Decimal(c.ledgerBalance);
    if (bal.greaterThan(0)) {
      totalCustomerDues = totalCustomerDues.plus(bal);
    }
  }

  return {
    kpis: {
      todaySales: todaySales.toFixed(2),
      todayBillsCount,
      activeStockWeightGrams: totalVaultWeight.toFixed(3),
      activeStockPieces: activeItems.length,
      customerDues: totalCustomerDues.toFixed(2)
    },
    bullionRates: latestRates,
    recentInvoices: allInvoices.slice(0, 5)
  };
}
