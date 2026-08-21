import { getDatabase } from '../db/connection.js';
import * as schema from '../db/schema/index.js';
import { validateRule114B, validateSection269ST, computeTaxBreakdown } from './compliance.service.js';
import { Decimal } from 'decimal.js';
import { eq, and, sql, desc, inArray } from 'drizzle-orm';
import crypto from 'crypto';

export interface CreateInvoiceItemInput {
  itemId?: string;
  itemCode: string;
  designTitle: string;
  metal: 'GOLD' | 'SILVER' | 'PLATINUM' | string;
  purity: string;
  fineness?: number | null;
  grossWeight: string;
  stoneWeight?: string;
  netWeight: string;
  rateApplied: string;
  masterRate?: string;
  isRateOverridden?: boolean;
  overrideReason?: string;
  makingChargeType?: 'PER_GRAM' | 'PERCENTAGE' | 'FLAT';
  makingChargeValue?: string;
  makingCharges?: string;
  wastagePct?: string;
  wastageValue?: string;
  stoneValue?: string;
  discount?: string;
  huid?: string;
}

export interface PaymentTenderInput {
  mode: 'CASH' | 'UPI' | 'CARD_DEBIT' | 'CARD_CREDIT' | 'BANK_TRANSFER' | 'OLD_GOLD_EXCHANGE' | 'CUSTOMER_LEDGER_CREDIT';
  amount: string;
  referenceNo?: string;
  notes?: string;
}

export interface CreateInvoicePayload {
  customerId?: string;
  customerName: string;
  customerMobile: string;
  customerPan?: string;
  customerAddress?: string;
  customerGstin?: string;
  items: CreateInvoiceItemInput[];
  payments: PaymentTenderInput[];
  oldGoldTransactionId?: string;
  oldGoldDeduction?: string;
  discountAmount?: string;
  notes?: string;
  idempotencyKey?: string;
}

export async function createInvoiceTransaction(
  payload: CreateInvoicePayload,
  userId: string,
  userName: string,
  shopId: string,
  ipAddress?: string
) {
  const { db } = await getDatabase();

  // 1. Check Idempotency Key
  if (payload.idempotencyKey) {
    const existingKey = await db
      .select()
      .from(schema.idempotencyKeys)
      .where(and(eq(schema.idempotencyKeys.shopId, shopId), eq(schema.idempotencyKeys.key, payload.idempotencyKey)))
      .limit(1);

    if (existingKey.length > 0 && existingKey[0].responseBody) {
      return existingKey[0].responseBody;
    }
  }

  // 2. Load Shop Settings for Defaults & Prefix
  const shopRows = await db.select().from(schema.shops).where(eq(schema.shops.id, shopId)).limit(1);
  if (shopRows.length === 0) {
    throw new Error('Shop not found');
  }
  const shop = shopRows[0];

  // 3. BEGIN ATOMIC TRANSACTION
  const createdInvoice = await db.transaction(async (tx: any) => {
    // A. Validate & Lock Items, Guarantee No Double Sale
    const lineItemSnapshots: any[] = [];
    let subtotalMetal = new Decimal(0);
    let subtotalMaking = new Decimal(0);
    let subtotalWastage = new Decimal(0);
    let subtotalStone = new Decimal(0);
    let subtotalItemDiscount = new Decimal(0);

    for (const itemInput of payload.items) {
      let dbItem: typeof schema.jewelleryItems.$inferSelect | null = null;

      if (itemInput.itemId) {
        // Query item within transaction and check status
        const itemRows = await tx
          .select()
          .from(schema.jewelleryItems)
          .where(and(eq(schema.jewelleryItems.id, itemInput.itemId), eq(schema.jewelleryItems.shopId, shopId)));

        if (itemRows.length === 0) {
          throw new Error(`Jewellery item ${itemInput.itemCode} does not exist in this showroom.`);
        }
        dbItem = itemRows[0];

        if (dbItem && dbItem.status !== 'IN_STOCK') {
          throw new Error(`DOUBLE SALE PREVENTED: Item '${dbItem.itemCode}' (${dbItem.designTitle}) is already ${dbItem.status} and cannot be sold.`);
        }
      }

      // Precision Decimal calculations & strict bounds checks
      const gross = new Decimal(itemInput.grossWeight);
      if (gross.isNaN() || gross.lessThanOrEqualTo(0)) {
        throw new Error(`Invalid gross weight for item '${itemInput.itemCode}'. Weight must be greater than 0.`);
      }

      const stone = new Decimal(itemInput.stoneWeight || '0.000');
      if (stone.isNaN() || stone.lessThan(0)) {
        throw new Error(`Invalid stone weight for item '${itemInput.itemCode}'.`);
      }

      const net = gross.minus(stone).toDecimalPlaces(3, Decimal.ROUND_HALF_UP);
      if (net.isNaN() || net.lessThanOrEqualTo(0)) {
        throw new Error(`Invalid net weight for item '${itemInput.itemCode}'. Net weight must be greater than 0.`);
      }

      const rate = new Decimal(itemInput.rateApplied);
      if (rate.isNaN() || rate.lessThan(0)) {
        throw new Error(`Invalid bullion rate for item '${itemInput.itemCode}'. Rate cannot be negative.`);
      }
      const metalVal = net.times(rate).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

      let makingVal = new Decimal(0);
      const mcType = itemInput.makingChargeType || dbItem?.makingChargeType || 'PER_GRAM';
      const mcRate = new Decimal(itemInput.makingChargeValue || itemInput.makingCharges || dbItem?.makingChargeValue || '0.00');
      if (mcRate.isNaN() || mcRate.lessThan(0)) {
        throw new Error(`Invalid making charge for item '${itemInput.itemCode}'.`);
      }

      if (mcType === 'PER_GRAM') {
        makingVal = net.times(mcRate).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
      } else if (mcType === 'PERCENTAGE') {
        makingVal = metalVal.times(mcRate.dividedBy(100)).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
      } else {
        makingVal = mcRate.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
      }

      const wastagePct = new Decimal(itemInput.wastagePct || dbItem?.wastagePct || '0.00');
      const wastageVal = metalVal.times(wastagePct.dividedBy(100)).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
      const stoneVal = new Decimal(itemInput.stoneValue || dbItem?.stoneValue || '0.00');
      const itemDisc = new Decimal(itemInput.discount || '0.00');
      if (itemDisc.isNaN() || itemDisc.lessThan(0)) {
        throw new Error(`Invalid discount for item '${itemInput.itemCode}'.`);
      }

      const itemTaxable = metalVal.plus(makingVal).plus(wastageVal).plus(stoneVal).minus(itemDisc);
      if (itemTaxable.lessThan(0)) {
        throw new Error(`Total item taxable value cannot be negative.`);
      }

      const taxRate = new Decimal(shop.defaultTaxPercent || '3.00');
      const itemTax = itemTaxable.times(taxRate.dividedBy(100)).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
      const itemTotal = itemTaxable.plus(itemTax);

      subtotalMetal = subtotalMetal.plus(metalVal);
      subtotalMaking = subtotalMaking.plus(makingVal);
      subtotalWastage = subtotalWastage.plus(wastageVal);
      subtotalStone = subtotalStone.plus(stoneVal);
      subtotalItemDiscount = subtotalItemDiscount.plus(itemDisc);

      const isOverridden = Boolean(itemInput.isRateOverridden);
      const masterRateVal = itemInput.masterRate ? new Decimal(itemInput.masterRate).toFixed(2) : rate.toFixed(2);
      const itemFineness = itemInput.fineness ? Math.round(Number(itemInput.fineness)) : ((dbItem as any)?.fineness || null);

      lineItemSnapshots.push({
        itemId: dbItem?.id || null,
        itemCode: itemInput.itemCode,
        designTitle: itemInput.designTitle,
        metal: itemInput.metal,
        purity: itemInput.purity,
        fineness: itemFineness,
        grossWeight: gross.toFixed(3),
        stoneWeight: stone.toFixed(3),
        netWeight: net.toFixed(3),
        huid: itemInput.huid || dbItem?.huid || null,
        boardRate: rate.toFixed(2), // The applied transaction rate
        masterRate: masterRateVal, // The showroom board rate at time of sale
        isRateOverridden: isOverridden,
        overrideReason: itemInput.overrideReason || null,
        metalValue: metalVal.toFixed(2),
        makingChargeType: mcType,
        makingCharges: makingVal.toFixed(2),
        wastagePct: wastagePct.toFixed(2),
        wastageValue: wastageVal.toFixed(2),
        stoneValue: stoneVal.toFixed(2),
        discount: itemDisc.toFixed(2),
        taxableAmount: itemTaxable.toFixed(2),
        taxPercent: taxRate.toFixed(2),
        taxAmount: itemTax.toFixed(2),
        finalAmount: itemTotal.toFixed(2)
      });
    }

    // B. Calculate Grand Totals
    const overallDiscount = new Decimal(payload.discountAmount || '0.00').plus(subtotalItemDiscount);
    const oldGoldCredit = new Decimal(payload.oldGoldDeduction || '0.00');

    const totalTaxable = subtotalMetal
      .plus(subtotalMaking)
      .plus(subtotalWastage)
      .plus(subtotalStone)
      .minus(overallDiscount)
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

    const taxBreakdown = computeTaxBreakdown(
      totalTaxable,
      shop.defaultTaxPercent,
      payload.customerAddress?.includes('State') ? '27' : '27',
      '27'
    );

    const totalTax = new Decimal(taxBreakdown.totalTaxAmount);
    const unroundedGrand = totalTaxable.plus(totalTax).minus(oldGoldCredit);
    const grandTotal = unroundedGrand.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

    // C. Verify Payments & Tenders
    let totalTendered = new Decimal(0);
    let totalCashTender = new Decimal(0);

    for (const p of payload.payments) {
      const amt = new Decimal(p.amount);
      totalTendered = totalTendered.plus(amt);
      if (p.mode === 'CASH') {
        totalCashTender = totalCashTender.plus(amt);
      }
    }

    // D. Validate Statutory Compliance Rules (Configurable)
    const panCheck = validateRule114B(grandTotal, payload.customerPan);
    if (!panCheck.compliant) {
      throw new Error(panCheck.reason);
    }

    const cashCheck = validateSection269ST(totalCashTender);
    if (!cashCheck.compliant) {
      throw new Error(cashCheck.reason);
    }

    // E. Generate Sequential Invoice Number
    const countRes = await tx
      .select({ count: sql<number>`count(*)` })
      .from(schema.invoices)
      .where(eq(schema.invoices.shopId, shopId));
    const nextSeq = (Number(countRes[0]?.count || 0) + 101).toString().padStart(5, '0');
    const invoiceNumber = `${shop.invoicePrefix || 'KJ-2026/'}${nextSeq}`;

    const balanceDue = grandTotal.minus(totalTendered).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    const paymentStatus = balanceDue.lessThanOrEqualTo(0)
      ? 'PAID'
      : totalTendered.greaterThan(0)
      ? 'PARTIALLY_PAID'
      : 'UNPAID';

    // F. Insert Invoice Header
    const [insertedInvoice] = await tx
      .insert(schema.invoices)
      .values({
        shopId,
        invoiceNumber,
        customerId: payload.customerId || null,
        customerName: payload.customerName,
        customerMobile: payload.customerMobile,
        customerPan: payload.customerPan || null,
        customerAddress: payload.customerAddress || null,
        customerGstin: payload.customerGstin || null,
        subtotalMetal: subtotalMetal.toFixed(2),
        makingChargesTotal: subtotalMaking.toFixed(2),
        wastageValueTotal: subtotalWastage.toFixed(2),
        stoneValueTotal: subtotalStone.toFixed(2),
        discountTotal: overallDiscount.toFixed(2),
        oldGoldDeductionTotal: oldGoldCredit.toFixed(2),
        taxableAmount: totalTaxable.toFixed(2),
        taxPercent: taxBreakdown.taxPercent,
        cgstAmount: taxBreakdown.cgstAmount,
        sgstAmount: taxBreakdown.sgstAmount,
        igstAmount: taxBreakdown.igstAmount,
        totalTaxAmount: taxBreakdown.totalTaxAmount,
        roundOff: '0.00',
        grandTotal: grandTotal.toFixed(2),
        amountPaid: totalTendered.toFixed(2),
        balanceDue: balanceDue.toFixed(2),
        paymentStatus,
        createdBy: userId,
        createdByName: userName,
        notes: payload.notes || null
      })
      .returning();

    // G. Insert Line Items & Update Stock Status to 'SOLD'
    for (const snap of lineItemSnapshots) {
      await tx.insert(schema.invoiceItems).values({
        invoiceId: insertedInvoice.id,
        ...snap
      });

      if (snap.itemId) {
        const updateRows = await tx
          .update(schema.jewelleryItems)
          .set({
            status: 'SOLD',
            updatedAt: new Date()
          })
          .where(
            and(
              eq(schema.jewelleryItems.id, snap.itemId),
              eq(schema.jewelleryItems.shopId, shopId),
              eq(schema.jewelleryItems.status, 'IN_STOCK')
            )
          )
          .returning({ id: schema.jewelleryItems.id });

        if (updateRows.length === 0) {
          throw new Error(`DOUBLE SALE PREVENTED: Item '${snap.itemCode}' was concurrently sold.`);
        }
      }
    }

    // H. Insert Payment Tender Records
    for (const p of payload.payments) {
      await tx.insert(schema.payments).values({
        shopId,
        invoiceId: insertedInvoice.id,
        customerId: payload.customerId || null,
        customerName: payload.customerName,
        amount: new Decimal(p.amount).toFixed(2),
        mode: p.mode,
        referenceNo: p.referenceNo || null,
        notes: p.notes || null,
        createdBy: userId,
        createdByName: userName
      });
    }

    // I. Update Customer Ledger Balance if Customer ID Provided
    if (payload.customerId) {
      const custRes = await tx
        .select()
        .from(schema.customers)
        .where(eq(schema.customers.id, payload.customerId));

      if (custRes.length > 0) {
        const prevBal = new Decimal(custRes[0].ledgerBalance || '0.00');
        const prevPurchases = new Decimal(custRes[0].totalPurchases || '0.00');
        const newBal = prevBal.plus(balanceDue);
        const newPurchases = prevPurchases.plus(grandTotal);

        await tx.insert(schema.customerLedgerEntries).values({
          shopId,
          customerId: payload.customerId,
          type: balanceDue.greaterThan(0) ? 'INVOICE_BALANCE_DUE' : 'INVOICE_SETTLED',
          referenceNo: invoiceNumber,
          description: balanceDue.greaterThan(0)
            ? `Unpaid balance on invoice #${invoiceNumber}`
            : `Invoice #${invoiceNumber} settled in full`,
          debit: grandTotal.toFixed(2),
          credit: totalTendered.toFixed(2),
          runningBalance: newBal.toFixed(2)
        });

        await tx
          .update(schema.customers)
          .set({
            ledgerBalance: newBal.toFixed(2),
            totalPurchases: newPurchases.toFixed(2),
            updatedAt: new Date()
          })
          .where(eq(schema.customers.id, payload.customerId));
      }
    }

    // J. Insert Audit Trail Record
    await tx.insert(schema.auditLogs).values({
      shopId,
      actorId: userId,
      actorName: userName,
      actorRole: 'STAFF',
      action: 'INVOICE_CONFIRMED',
      entityName: 'INVOICE',
      entityId: insertedInvoice.id,
      stateDiff: {
        invoiceNumber,
        grandTotal: grandTotal.toFixed(2),
        itemCount: lineItemSnapshots.length,
        paymentStatus
      },
      ipAddress: ipAddress || null
    });

    // J2. Log transaction-specific Rate Overrides to Audit Trail
    for (const snap of lineItemSnapshots) {
      if (snap.isRateOverridden) {
        await tx.insert(schema.auditLogs).values({
          shopId,
          actorId: userId,
          actorName: userName,
          actorRole: 'STAFF',
          action: 'RATE_OVERRIDE_APPLIED',
          entityName: 'INVOICE_ITEM',
          entityId: `${insertedInvoice.invoiceNumber}:${snap.itemCode}`,
          stateDiff: {
            invoiceNumber: insertedInvoice.invoiceNumber,
            itemCode: snap.itemCode,
            metal: snap.metal,
            purity: snap.purity,
            masterRate: snap.masterRate,
            appliedRate: snap.boardRate,
            overrideReason: snap.overrideReason
          },
          ipAddress: ipAddress || null
        });
      }
    }

    // K. Load Complete Invoice Object with Items
    const itemsList = await tx
      .select()
      .from(schema.invoiceItems)
      .where(eq(schema.invoiceItems.invoiceId, insertedInvoice.id));

    const invoiceResult = normalizeInvoice(insertedInvoice, itemsList);

    // L. Save in Idempotency Keys table if provided
    if (payload.idempotencyKey) {
      const requestHash = crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
      await tx.insert(schema.idempotencyKeys).values({
        key: payload.idempotencyKey,
        shopId,
        endpoint: '/api/v1/invoices',
        requestHash,
        responseStatusCode: '200',
        responseBody: invoiceResult,
        expiresAt
      });
    }

    return invoiceResult;
  });

  return createdInvoice;
}

export function normalizeInvoice(inv: any, items: any[] = []) {
  if (!inv) return null;
  const taxableAmount = inv.taxableAmount != null ? String(inv.taxableAmount) : '0.00';
  const totalTaxAmount = inv.totalTaxAmount != null ? String(inv.totalTaxAmount) : (inv.taxAmount != null ? String(inv.taxAmount) : '0.00');
  const grandTotal = inv.grandTotal != null ? String(inv.grandTotal) : (inv.finalPayable != null ? String(inv.finalPayable) : '0.00');
  const oldGoldDeductionTotal = inv.oldGoldDeductionTotal != null ? String(inv.oldGoldDeductionTotal) : (inv.oldGoldDeduction != null ? String(inv.oldGoldDeduction) : '0.00');

  const halfTax = (parseFloat(totalTaxAmount || '0.00') / 2).toFixed(2);
  const cgstAmount = inv.cgstAmount != null ? String(inv.cgstAmount) : halfTax;
  const sgstAmount = inv.sgstAmount != null ? String(inv.sgstAmount) : halfTax;

  const normalizedItems = (items || []).map((it: any) => {
    const metalVal = it.metalValue != null ? String(it.metalValue) : (it.baseMetalValue != null ? String(it.baseMetalValue) : '0.00');
    const finalAmt = it.finalAmount != null ? String(it.finalAmount) : (it.totalAmount != null ? String(it.totalAmount) : '0.00');
    const taxAmt = it.taxAmount != null ? String(it.taxAmount) : '0.00';
    const makingChg = it.makingCharges != null ? String(it.makingCharges) : '0.00';
    const taxableAmt = it.taxableAmount != null ? String(it.taxableAmount) : '0.00';

    return {
      ...it,
      metalValue: metalVal,
      baseMetalValue: metalVal,
      finalAmount: finalAmt,
      totalAmount: finalAmt,
      taxAmount: taxAmt,
      makingCharges: makingChg,
      taxableAmount: taxableAmt
    };
  });

  return {
    ...inv,
    taxableAmount,
    totalTaxAmount,
    taxAmount: totalTaxAmount,
    cgstAmount,
    sgstAmount,
    oldGoldDeductionTotal,
    oldGoldDeduction: oldGoldDeductionTotal,
    grandTotal,
    finalPayable: grandTotal,
    items: normalizedItems
  };
}

export async function getInvoiceById(shopId: string, invoiceId: string) {
  const { db } = await getDatabase();
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(invoiceId);

  let inv: any = null;

  if (isUuid) {
    const invoiceRows = await db
      .select()
      .from(schema.invoices)
      .where(and(eq(schema.invoices.id, invoiceId), eq(schema.invoices.shopId, shopId)))
      .limit(1);

    if (invoiceRows.length > 0) {
      inv = invoiceRows[0];
    }
  }

  if (!inv) {
    // Try lookup by invoice number
    const byNumber = await db
      .select()
      .from(schema.invoices)
      .where(and(eq(schema.invoices.invoiceNumber, invoiceId), eq(schema.invoices.shopId, shopId)))
      .limit(1);

    if (byNumber.length > 0) {
      inv = byNumber[0];
    }
  }

  if (!inv) return null;

  const items = await db.select().from(schema.invoiceItems).where(eq(schema.invoiceItems.invoiceId, inv.id));
  return normalizeInvoice(inv, items);
}

export async function listInvoices(shopId: string) {
  const { db } = await getDatabase();
  const list = await db
    .select()
    .from(schema.invoices)
    .where(eq(schema.invoices.shopId, shopId))
    .orderBy(desc(schema.invoices.createdAt));

  if (list.length === 0) return [];

  const invoiceIds = list.map((inv: any) => inv.id);
  const allItems = await db
    .select()
    .from(schema.invoiceItems)
    .where(inArray(schema.invoiceItems.invoiceId, invoiceIds));

  const itemsByInvoiceId = new Map<string, any[]>();
  for (const item of allItems) {
    let arr = itemsByInvoiceId.get(item.invoiceId);
    if (!arr) {
      arr = [];
      itemsByInvoiceId.set(item.invoiceId, arr);
    }
    arr.push(item);
  }

  return list.map((inv: any) => normalizeInvoice(inv, itemsByInvoiceId.get(inv.id) || []));
}
