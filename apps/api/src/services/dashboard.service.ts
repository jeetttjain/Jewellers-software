import { getDatabase } from '../db/connection.js';
import * as schema from '../db/schema/index.js';
import { getLatestRates } from './rates.service.js';
import { Decimal } from 'decimal.js';
import { eq, and, desc, gte } from 'drizzle-orm';

export async function getDashboardData(shopId: string) {
  const { db } = await getDatabase();

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const [latestRates, recentInvoices, allInvoicesToday, activeItems, customersList] = await Promise.all([
    getLatestRates(shopId),
    db
      .select()
      .from(schema.invoices)
      .where(eq(schema.invoices.shopId, shopId))
      .orderBy(desc(schema.invoices.createdAt))
      .limit(5),
    db
      .select({ grandTotal: schema.invoices.grandTotal, createdAt: schema.invoices.createdAt })
      .from(schema.invoices)
      .where(
        and(
          eq(schema.invoices.shopId, shopId),
          gte(schema.invoices.createdAt, startOfDay)
        )
      ),
    db
      .select({ netWeight: schema.jewelleryItems.netWeight })
      .from(schema.jewelleryItems)
      .where(and(eq(schema.jewelleryItems.shopId, shopId), eq(schema.jewelleryItems.status, 'IN_STOCK'))),
    db
      .select({ ledgerBalance: schema.customers.ledgerBalance })
      .from(schema.customers)
      .where(eq(schema.customers.shopId, shopId))
  ]);

  let todaySales = new Decimal(0);
  const todayBillsCount = allInvoicesToday.length;

  for (const inv of allInvoicesToday) {
    todaySales = todaySales.plus(new Decimal(inv.grandTotal));
  }

  let totalVaultWeight = new Decimal(0);
  for (const item of activeItems) {
    totalVaultWeight = totalVaultWeight.plus(new Decimal(item.netWeight));
  }

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
    recentInvoices
  };
}
