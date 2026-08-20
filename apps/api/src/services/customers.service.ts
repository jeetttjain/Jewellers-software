import { getDatabase } from '../db/connection.js';
import * as schema from '../db/schema/index.js';
import { Decimal } from 'decimal.js';
import { eq, and, desc, sql } from 'drizzle-orm';

export interface CreateCustomerInput {
  name: string;
  mobile: string;
  email?: string;
  pan?: string;
  address?: string;
  city?: string;
  stateCode?: string;
  gstin?: string;
}

export async function listCustomers(shopId: string, search?: string) {
  const { db } = await getDatabase();
  const customers = await db
    .select()
    .from(schema.customers)
    .where(eq(schema.customers.shopId, shopId))
    .orderBy(desc(schema.customers.createdAt));

  if (!search) return customers;

  const q = search.toLowerCase().trim();
  return customers.filter((c: typeof schema.customers.$inferSelect) => {
    return (
      c.name.toLowerCase().includes(q) ||
      c.mobile.includes(q) ||
      (c.pan && c.pan.toLowerCase().includes(q))
    );
  });
}

export async function getCustomerById(shopId: string, customerId: string) {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(customerId);
  if (!isUuid) return null;

  const { db } = await getDatabase();

  const custRows = await db
    .select()
    .from(schema.customers)
    .where(and(eq(schema.customers.id, customerId), eq(schema.customers.shopId, shopId)))
    .limit(1);

  if (custRows.length === 0) return null;
  const customer = custRows[0];

  // Load ledger history (authoritative source of truth)
  const ledger = await db
    .select()
    .from(schema.customerLedgerEntries)
    .where(and(eq(schema.customerLedgerEntries.customerId, customerId), eq(schema.customerLedgerEntries.shopId, shopId)))
    .orderBy(desc(schema.customerLedgerEntries.date));

  // Load invoice history
  const invoicesList = await db
    .select()
    .from(schema.invoices)
    .where(and(eq(schema.invoices.customerId, customerId), eq(schema.invoices.shopId, shopId)))
    .orderBy(desc(schema.invoices.createdAt));

  return {
    customer,
    ledger,
    invoices: invoicesList
  };
}

export async function createCustomer(shopId: string, input: CreateCustomerInput) {
  const { db } = await getDatabase();

  const mobileClean = input.mobile.replace(/\D/g, '').slice(-10);
  if (mobileClean.length !== 10) {
    throw new Error('Customer mobile number must be a valid 10-digit number.');
  }

  // Check unique mobile in shop
  const existing = await db
    .select()
    .from(schema.customers)
    .where(and(eq(schema.customers.shopId, shopId), eq(schema.customers.mobile, mobileClean)))
    .limit(1);

  if (existing.length > 0) {
    return existing[0]; // Return existing profile
  }

  const panClean = input.pan ? input.pan.trim().toUpperCase() : null;

  const [inserted] = await db
    .insert(schema.customers)
    .values({
      shopId,
      name: input.name.trim(),
      mobile: mobileClean,
      email: input.email ? input.email.trim().toLowerCase() : null,
      pan: panClean,
      address: input.address ? input.address.trim() : null,
      city: input.city || 'Mumbai',
      stateCode: input.stateCode || '27',
      gstin: input.gstin ? input.gstin.trim().toUpperCase() : null,
      ledgerBalance: '0.00',
      totalPurchases: '0.00'
    })
    .returning();

  return inserted;
}

export async function recordCustomerPayment(
  shopId: string,
  customerId: string,
  amount: string,
  mode: 'CASH' | 'UPI' | 'CARD_DEBIT' | 'CARD_CREDIT' | 'BANK_TRANSFER',
  referenceNo: string | undefined,
  userId: string,
  userName: string
) {
  const { db } = await getDatabase();
  const payAmt = new Decimal(amount);

  if (payAmt.lessThanOrEqualTo(0)) {
    throw new Error('Payment voucher amount must be greater than zero.');
  }

  return db.transaction(async (tx: any) => {
    const custRows = await tx
      .select()
      .from(schema.customers)
      .where(and(eq(schema.customers.id, customerId), eq(schema.customers.shopId, shopId)))
      .limit(1);

    if (custRows.length === 0) {
      throw new Error('Customer not found');
    }
    const customer = custRows[0];

    const prevBalance = new Decimal(customer.ledgerBalance);
    const newBalance = prevBalance.minus(payAmt).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

    const countRes = await tx
      .select({ count: sql<number>`count(*)` })
      .from(schema.payments)
      .where(eq(schema.payments.shopId, shopId));
    const receiptNumber = `RCP-${(Number(countRes[0]?.count || 0) + 1001).toString()}`;

    // 1. Insert Ledger Credit Entry
    await tx.insert(schema.customerLedgerEntries).values({
      shopId,
      customerId,
      type: 'DUES_PAYMENT_RECEIPT',
      referenceNo: receiptNumber,
      description: `Payment received via ${mode}${referenceNo ? ` (Ref: ${referenceNo})` : ''}`,
      debit: '0.00',
      credit: payAmt.toFixed(2),
      runningBalance: newBalance.toFixed(2)
    });

    // 2. Update Customer Cached Ledger Balance
    const [updatedCustomer] = await tx
      .update(schema.customers)
      .set({
        ledgerBalance: newBalance.toFixed(2),
        updatedAt: new Date()
      })
      .where(eq(schema.customers.id, customerId))
      .returning();

    // 3. Insert Payment Record
    await tx.insert(schema.payments).values({
      shopId,
      customerId,
      customerName: customer.name,
      amount: payAmt.toFixed(2),
      mode,
      referenceNo: referenceNo || receiptNumber,
      notes: `Khata ledger dues settlement voucher ${receiptNumber}`,
      createdBy: userId,
      createdByName: userName
    });

    // 4. Insert Audit Log
    await tx.insert(schema.auditLogs).values({
      shopId,
      actorId: userId,
      actorName: userName,
      actorRole: 'CASHIER',
      action: 'CUSTOMER_PAYMENT_RECORDED',
      entityName: 'CUSTOMER_LEDGER',
      entityId: customerId,
      stateDiff: {
        receiptNumber,
        amountSettled: payAmt.toFixed(2),
        previousBalance: prevBalance.toFixed(2),
        newBalance: newBalance.toFixed(2)
      }
    });

    return {
      customer: updatedCustomer,
      receiptNumber,
      amountSettled: payAmt.toFixed(2),
      newBalance: newBalance.toFixed(2)
    };
  });
}
