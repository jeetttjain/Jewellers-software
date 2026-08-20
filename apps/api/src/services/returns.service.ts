import { getDatabase } from '../db/connection.js';
import * as schema from '../db/schema/index.js';
import { verifyPin } from './crypto.js';
import { Decimal } from 'decimal.js';
import { eq, and, desc, sql } from 'drizzle-orm';

export interface CreateReturnInput {
  originalInvoiceNumber: string;
  itemCode: string;
  returnReason: string;
  refundAmount: string;
  deductionAmount?: string;
  restockDestination?: 'BACK_TO_STOCK' | 'MELT_VAULT';
  supervisorPin: string;
}

export async function listReturns(shopId: string) {
  const { db } = await getDatabase();
  return db
    .select()
    .from(schema.returns)
    .where(eq(schema.returns.shopId, shopId))
    .orderBy(desc(schema.returns.createdAt));
}

export async function createReturnTransaction(
  shopId: string,
  input: CreateReturnInput,
  cashierId: string,
  cashierName: string
) {
  const { db } = await getDatabase();

  // 1. Authorize Supervisor PIN (Must be ADMIN or MANAGER)
  const supervisors = await db
    .select()
    .from(schema.users)
    .where(and(eq(schema.users.shopId, shopId), eq(schema.users.isActive, true)));

  let authorizedSupervisor: typeof schema.users.$inferSelect | null = null;

  for (const sup of supervisors) {
    if ((sup.role === 'ADMIN' || sup.role === 'MANAGER') && sup.pinHash) {
      const match = await verifyPin(input.supervisorPin.trim(), sup.pinHash);
      if (match) {
        authorizedSupervisor = sup;
        break;
      }
    }
  }

  if (!authorizedSupervisor) {
    throw new Error('Supervisor PIN verification failed. Return authorization requires Admin or Manager PIN.');
  }

  // 2. Lookup Original Invoice
  const invoiceRows = await db
    .select()
    .from(schema.invoices)
    .where(and(eq(schema.invoices.invoiceNumber, input.originalInvoiceNumber.trim()), eq(schema.invoices.shopId, shopId)))
    .limit(1);

  if (invoiceRows.length === 0) {
    throw new Error(`Original tax invoice #${input.originalInvoiceNumber} not found.`);
  }
  const invoice = invoiceRows[0];

  // 3. Lookup Item
  const itemRows = await db
    .select()
    .from(schema.jewelleryItems)
    .where(and(eq(schema.jewelleryItems.itemCode, input.itemCode.trim().toUpperCase()), eq(schema.jewelleryItems.shopId, shopId)))
    .limit(1);

  if (itemRows.length === 0) {
    throw new Error(`Jewellery item '${input.itemCode}' not found in inventory catalog.`);
  }
  const item = itemRows[0];

  // 4. Precision Decimal calculations
  const refund = new Decimal(input.refundAmount);
  const deduction = new Decimal(input.deductionAmount || '0.00');
  const netRefund = refund.minus(deduction).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

  if (netRefund.lessThanOrEqualTo(0)) {
    throw new Error('Net refund amount must be greater than zero.');
  }

  return db.transaction(async (tx: any) => {
    // Generate Sequential Return Voucher Number
    const countRes = await tx
      .select({ count: sql<number>`count(*)` })
      .from(schema.returns)
      .where(eq(schema.returns.shopId, shopId));
    const seq = (Number(countRes[0]?.count || 0) + 101).toString().padStart(5, '0');
    const returnNumber = `RET-2026/${seq}`;

    const dest = input.restockDestination || 'BACK_TO_STOCK';

    // Insert Return Record
    const [insertedReturn] = await tx
      .insert(schema.returns)
      .values({
        shopId,
        returnNumber,
        originalInvoiceId: invoice.id,
        originalInvoiceNumber: invoice.invoiceNumber,
        itemId: item.id,
        itemCode: item.itemCode,
        itemTitle: item.designTitle,
        customerName: invoice.customerName,
        returnReason: input.returnReason.trim(),
        refundAmount: refund.toFixed(2),
        deductionAmount: deduction.toFixed(2),
        netRefundAmount: netRefund.toFixed(2),
        restockDestination: dest,
        authorizedBy: authorizedSupervisor.id,
        authorizedByName: authorizedSupervisor.name
      })
      .returning();

    // Insert Return Item Record
    await tx.insert(schema.returnItems).values({
      returnId: insertedReturn.id,
      itemId: item.id,
      itemCode: item.itemCode,
      refundAmount: refund.toFixed(2),
      deductionAmount: deduction.toFixed(2),
      netAmount: netRefund.toFixed(2)
    });

    // Update Item Status based on destination
    const newStatus = dest === 'BACK_TO_STOCK' ? 'IN_STOCK' : 'MELTED';
    await tx
      .update(schema.jewelleryItems)
      .set({
        status: newStatus,
        updatedAt: new Date()
      })
      .where(eq(schema.jewelleryItems.id, item.id));

    // Audit Log Entry
    await tx.insert(schema.auditLogs).values({
      shopId,
      actorId: cashierId,
      actorName: cashierName,
      actorRole: 'CASHIER',
      action: 'SALES_RETURN_PROCESSED',
      entityName: 'RETURNS',
      entityId: insertedReturn.id,
      stateDiff: {
        returnNumber,
        originalInvoiceNumber: invoice.invoiceNumber,
        itemCode: item.itemCode,
        netRefundAmount: netRefund.toFixed(2),
        restockDestination: dest,
        supervisor: authorizedSupervisor.name
      }
    });

    return insertedReturn;
  });
}
