import { getDatabase } from '../db/connection.js';
import * as schema from '../db/schema/index.js';
import { computeTaxBreakdown } from './compliance.service.js';
import { Decimal } from 'decimal.js';
import { eq, and, desc, sql } from 'drizzle-orm';
import crypto from 'crypto';

export interface CreatePurchaseItemInput {
  itemId?: string;
  itemCode: string;
  category: string;
  designTitle: string;
  metal: 'GOLD' | 'SILVER' | 'PLATINUM' | string;
  purity: string;
  fineness?: number | null;
  grossWeight: string;
  stoneWeight?: string;
  netWeight: string;
  pureWeight?: string;
  purchaseRate: string;
  benchmarkRate?: string;
  metalCost: string;
  makingChargeType?: 'PER_GRAM' | 'PERCENTAGE' | 'FLAT';
  makingRate?: string;
  makingCost?: string;
  wastagePct?: string;
  wastageValue?: string;
  stoneValue?: string;
  taxableAmount: string;
  taxAmount?: string;
  finalAmount: string;
  huid?: string;
  autoCreateStock?: boolean;
}

export interface PurchasePaymentInput {
  amount: string;
  mode: 'CASH' | 'UPI' | 'BANK_TRANSFER' | 'CHEQUE' | 'NEFT_RTGS' | 'OLD_GOLD_EXCHANGE';
  referenceNo?: string;
  notes?: string;
}

export interface CreatePurchasePayload {
  supplierId: string;
  supplierInvoiceNumber?: string;
  purchaseDate?: string;
  otherCharges?: string;
  discountTotal?: string;
  taxPercent?: string;
  notes?: string;
  items: CreatePurchaseItemInput[];
  payments?: PurchasePaymentInput[];
  idempotencyKey?: string;
}

export async function listPurchases(
  shopId: string,
  filterStatus?: string,
  search?: string,
  supplierId?: string
) {
  const { db } = await getDatabase();

  const purchaseRows = await db
    .select()
    .from(schema.purchases)
    .where(eq(schema.purchases.shopId, shopId))
    .orderBy(desc(schema.purchases.purchaseDate), desc(schema.purchases.createdAt));

  return purchaseRows.filter((p: typeof schema.purchases.$inferSelect) => {
    if (filterStatus && filterStatus !== 'ALL' && p.paymentStatus !== filterStatus) {
      return false;
    }
    if (supplierId && p.supplierId !== supplierId) {
      return false;
    }
    if (search) {
      const q = search.toLowerCase().trim();
      const matchNum = p.purchaseNumber.toLowerCase().includes(q);
      const matchSupp = p.supplierName.toLowerCase().includes(q);
      const matchInv = p.supplierInvoiceNumber ? p.supplierInvoiceNumber.toLowerCase().includes(q) : false;
      if (!matchNum && !matchSupp && !matchInv) return false;
    }
    return true;
  });
}

export async function getPurchaseById(shopId: string, id: string) {
  const { db } = await getDatabase();

  const purchaseRows = await db
    .select()
    .from(schema.purchases)
    .where(and(eq(schema.purchases.id, id), eq(schema.purchases.shopId, shopId)))
    .limit(1);

  if (purchaseRows.length === 0) {
    return null;
  }

  const purchase = purchaseRows[0];

  const items = await db
    .select()
    .from(schema.purchaseItems)
    .where(eq(schema.purchaseItems.purchaseId, purchase.id));

  const payments = await db
    .select()
    .from(schema.purchasePayments)
    .where(eq(schema.purchasePayments.purchaseId, purchase.id))
    .orderBy(desc(schema.purchasePayments.createdAt));

  return {
    ...purchase,
    items,
    payments
  };
}

export async function createPurchaseTransaction(
  shopId: string,
  payload: CreatePurchasePayload,
  userId: string,
  userName: string,
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

  // 2. Validate Supplier
  const supplierRows = await db
    .select()
    .from(schema.suppliers)
    .where(and(eq(schema.suppliers.id, payload.supplierId), eq(schema.suppliers.shopId, shopId)))
    .limit(1);

  if (supplierRows.length === 0) {
    throw new Error('Selected supplier does not exist.');
  }
  const supplier = supplierRows[0];

  // 3. Load Shop Settings for Defaults
  const shopRows = await db.select().from(schema.shops).where(eq(schema.shops.id, shopId)).limit(1);
  if (shopRows.length === 0) {
    throw new Error('Shop not found.');
  }
  const shop = shopRows[0];

  // 4. ATOMIC DATABASE TRANSACTION
  const createdPurchase = await db.transaction(async (tx: any) => {
    let subtotalMetal = new Decimal(0);
    let makingChargesTotal = new Decimal(0);
    let wastageValueTotal = new Decimal(0);
    let stoneValueTotal = new Decimal(0);
    let metalTotalWeight = new Decimal(0);
    let pureWeightTotal = new Decimal(0);

    const calculatedItems: any[] = [];

    // A. Validate each purchase line item
    for (const itemInput of payload.items) {
      const gross = new Decimal(itemInput.grossWeight);
      const stone = new Decimal(itemInput.stoneWeight || '0.000');
      const net = gross.minus(stone).toDecimalPlaces(3, Decimal.ROUND_HALF_UP);

      if (net.lessThanOrEqualTo(0)) {
        throw new Error(`Item '${itemInput.itemCode}' has invalid net weight (gross must exceed stone weight).`);
      }

      metalTotalWeight = metalTotalWeight.plus(gross);

      // Fineness & pure weight calculation
      let fineness = itemInput.fineness ? Math.round(Number(itemInput.fineness)) : 916;
      if (!itemInput.fineness && itemInput.purity) {
        if (itemInput.purity.includes('24')) fineness = 999;
        else if (itemInput.purity.includes('22')) fineness = 916;
        else if (itemInput.purity.includes('18')) fineness = 750;
        else if (itemInput.purity.includes('14')) fineness = 585;
      }

      const pureWeight = net.times(fineness).dividedBy(1000).toDecimalPlaces(3, Decimal.ROUND_HALF_UP);
      pureWeightTotal = pureWeightTotal.plus(pureWeight);

      const rate = new Decimal(itemInput.purchaseRate);
      const metalCost = net.times(rate).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
      subtotalMetal = subtotalMetal.plus(metalCost);

      let makingCost = new Decimal(0);
      const mcType = itemInput.makingChargeType || 'PER_GRAM';
      const mcRate = new Decimal(itemInput.makingRate || '0.00');

      if (mcType === 'PER_GRAM') {
        makingCost = net.times(mcRate).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
      } else if (mcType === 'PERCENTAGE') {
        makingCost = metalCost.times(mcRate.dividedBy(100)).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
      } else {
        makingCost = mcRate.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
      }
      makingChargesTotal = makingChargesTotal.plus(makingCost);

      const wPct = new Decimal(itemInput.wastagePct || '0.00');
      const wVal = metalCost.times(wPct.dividedBy(100)).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
      wastageValueTotal = wastageValueTotal.plus(wVal);

      const stoneVal = new Decimal(itemInput.stoneValue || '0.00');
      stoneValueTotal = stoneValueTotal.plus(stoneVal);

      const itemTaxable = metalCost.plus(makingCost).plus(wVal).plus(stoneVal);

      calculatedItems.push({
        itemCode: itemInput.itemCode.trim().toUpperCase(),
        category: itemInput.category,
        designTitle: itemInput.designTitle.trim(),
        metal: itemInput.metal,
        purity: itemInput.purity,
        fineness,
        grossWeight: gross.toFixed(3),
        stoneWeight: stone.toFixed(3),
        netWeight: net.toFixed(3),
        pureWeight: pureWeight.toFixed(3),
        purchaseRate: rate.toFixed(2),
        benchmarkRate: itemInput.benchmarkRate ? new Decimal(itemInput.benchmarkRate).toFixed(2) : null,
        metalCost: metalCost.toFixed(2),
        makingChargeType: mcType,
        makingRate: mcRate.toFixed(2),
        makingCost: makingCost.toFixed(2),
        wastagePct: wPct.toFixed(2),
        wastageValue: wVal.toFixed(2),
        stoneValue: stoneVal.toFixed(2),
        taxableAmount: itemTaxable.toFixed(2),
        taxAmount: '0.00',
        finalAmount: itemTaxable.toFixed(2),
        huid: itemInput.huid ? itemInput.huid.trim().toUpperCase() : null,
        autoCreateStock: itemInput.autoCreateStock !== false
      });
    }

    // B. Grand Totals & B2B GST Calculation
    const otherChg = new Decimal(payload.otherCharges || '0.00');
    const discTotal = new Decimal(payload.discountTotal || '0.00');

    const totalTaxable = subtotalMetal
      .plus(makingChargesTotal)
      .plus(wastageValueTotal)
      .plus(stoneValueTotal)
      .plus(otherChg)
      .minus(discTotal)
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

    const taxPercent = payload.taxPercent || shop.defaultTaxPercent || '3.00';
    const supplierStateCode = supplier.stateCode || '27';
    const shopStateCode = '27'; // Standard Maharashtra state code benchmark

    const taxBreakdown = computeTaxBreakdown(totalTaxable, taxPercent, supplierStateCode, shopStateCode);
    const totalTax = new Decimal(taxBreakdown.totalTaxAmount);

    const unroundedGrand = totalTaxable.plus(totalTax);
    const grandTotal = unroundedGrand.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

    // C. Payment Tenders
    let totalPaid = new Decimal(0);
    const paymentsPayload = payload.payments || [];
    for (const p of paymentsPayload) {
      totalPaid = totalPaid.plus(new Decimal(p.amount));
    }

    const balanceDue = grandTotal.minus(totalPaid).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    const paymentStatus = balanceDue.lessThanOrEqualTo(0)
      ? 'PAID'
      : totalPaid.greaterThan(0)
      ? 'PARTIALLY_PAID'
      : 'UNPAID';

    // D. Generate Sequential Purchase Number
    const countRes = await tx
      .select({ count: sql<number>`count(*)` })
      .from(schema.purchases)
      .where(eq(schema.purchases.shopId, shopId));
    const nextSeq = (Number(countRes[0]?.count || 0) + 101).toString().padStart(5, '0');
    const purchaseNumber = `PUR-2026/${nextSeq}`;

    // E. Insert Purchase Header
    const [insertedPurchase] = await tx
      .insert(schema.purchases)
      .values({
        shopId,
        supplierId: supplier.id,
        supplierName: supplier.name,
        supplierGstin: supplier.gstin,
        supplierStateCode: supplier.stateCode,
        purchaseNumber,
        supplierInvoiceNumber: payload.supplierInvoiceNumber ? payload.supplierInvoiceNumber.trim() : null,
        purchaseDate: payload.purchaseDate ? new Date(payload.purchaseDate) : new Date(),
        metalTotalWeight: metalTotalWeight.toFixed(3),
        pureWeightTotal: pureWeightTotal.toFixed(3),
        subtotalMetal: subtotalMetal.toFixed(2),
        makingChargesTotal: makingChargesTotal.toFixed(2),
        wastageValueTotal: wastageValueTotal.toFixed(2),
        stoneValueTotal: stoneValueTotal.toFixed(2),
        otherCharges: otherChg.toFixed(2),
        discountTotal: discTotal.toFixed(2),
        taxableAmount: totalTaxable.toFixed(2),
        taxPercent: taxBreakdown.taxPercent,
        cgstAmount: taxBreakdown.cgstAmount,
        sgstAmount: taxBreakdown.sgstAmount,
        igstAmount: taxBreakdown.igstAmount,
        totalTaxAmount: taxBreakdown.totalTaxAmount,
        roundOff: '0.00',
        grandTotal: grandTotal.toFixed(2),
        amountPaid: totalPaid.toFixed(2),
        balanceDue: balanceDue.toFixed(2),
        paymentStatus,
        createdBy: userId,
        createdByName: userName,
        notes: payload.notes || null
      })
      .returning();

    const createdItemIds: string[] = [];
    const insertedLineItems: any[] = [];

    // F. Insert Line Items & Auto-Create Inventory Stock
    for (const item of calculatedItems) {
      let createdItemId: string | null = null;

      if (item.autoCreateStock) {
        // Check if itemCode already exists
        const existingStock = await tx
          .select()
          .from(schema.jewelleryItems)
          .where(eq(schema.jewelleryItems.itemCode, item.itemCode))
          .limit(1);

        if (existingStock.length > 0) {
          throw new Error(`Item serial code '${item.itemCode}' already exists in inventory.`);
        }

        const [createdStock] = await tx
          .insert(schema.jewelleryItems)
          .values({
            shopId,
            supplierId: supplier.id,
            purchaseId: insertedPurchase.id,
            itemCode: item.itemCode,
            category: item.category,
            designTitle: item.designTitle,
            metal: item.metal,
            purity: item.purity,
            fineness: item.fineness,
            grossWeight: item.grossWeight,
            stoneWeight: item.stoneWeight,
            netWeight: item.netWeight,
            huid: item.huid,
            hallmarkVerified: true,
            makingChargeType: item.makingChargeType,
            makingChargeValue: item.makingRate,
            wastagePct: item.wastagePct,
            stoneValue: item.stoneValue,
            purchaseCostRate: item.purchaseRate,
            costMetalValue: item.metalCost,
            status: 'IN_STOCK'
          })
          .returning();

        createdItemId = createdStock.id;
        createdItemIds.push(createdStock.id);
      }

      const [lineItem] = await tx
        .insert(schema.purchaseItems)
        .values({
          purchaseId: insertedPurchase.id,
          itemId: createdItemId,
          ...item
        })
        .returning();

      insertedLineItems.push(lineItem);
    }

    // G. Insert Payments
    const insertedPayments: any[] = [];
    for (const p of paymentsPayload) {
      const [pmt] = await tx
        .insert(schema.purchasePayments)
        .values({
          shopId,
          purchaseId: insertedPurchase.id,
          supplierId: supplier.id,
          amount: new Decimal(p.amount).toFixed(2),
          mode: p.mode,
          referenceNo: p.referenceNo || null,
          notes: p.notes || null,
          createdBy: userId,
          createdByName: userName
        })
        .returning();
      insertedPayments.push(pmt);
    }

    // H. Update Supplier Ledger (Accounts Payable)
    const prevBalance = new Decimal(supplier.currentBalance || '0.00');
    // Credit entry for the purchase bill (increases payable)
    const balanceAfterPurchase = prevBalance.plus(grandTotal);

    await tx.insert(schema.supplierLedgerEntries).values({
      shopId,
      supplierId: supplier.id,
      type: 'PURCHASE_BILL',
      referenceNo: purchaseNumber,
      description: `Purchase Bill #${purchaseNumber}${payload.supplierInvoiceNumber ? ` (Inv: ${payload.supplierInvoiceNumber})` : ''}`,
      credit: grandTotal.toFixed(2),
      debit: '0.00',
      runningBalance: balanceAfterPurchase.toFixed(2)
    });

    let finalBalance = balanceAfterPurchase;

    // Debit entry for payments made (decreases payable)
    if (totalPaid.greaterThan(0)) {
      finalBalance = balanceAfterPurchase.minus(totalPaid);
      await tx.insert(schema.supplierLedgerEntries).values({
        shopId,
        supplierId: supplier.id,
        type: 'PAYMENT_OUT',
        referenceNo: `PMT-${purchaseNumber}`,
        description: `Payment tendered for Purchase Bill #${purchaseNumber}`,
        credit: '0.00',
        debit: totalPaid.toFixed(2),
        runningBalance: finalBalance.toFixed(2)
      });
    }

    await tx
      .update(schema.suppliers)
      .set({
        currentBalance: finalBalance.toFixed(2),
        updatedAt: new Date()
      })
      .where(eq(schema.suppliers.id, supplier.id));

    // I. Auto-Enqueue Created Items to Label Print Queue
    if (createdItemIds.length > 0) {
      await tx.insert(schema.labelJobs).values({
        shopId,
        itemIds: createdItemIds,
        format: 'DUMBBELL',
        status: 'PENDING',
        printedBy: userId
      });
    }

    // J. Write Immutable Audit Trail
    await tx.insert(schema.auditLogs).values({
      shopId,
      actorId: userId,
      actorName: userName,
      actorRole: 'STAFF',
      action: 'PURCHASE_CONFIRMED',
      entityName: 'PURCHASE',
      entityId: insertedPurchase.id,
      stateDiff: {
        purchaseNumber,
        supplierName: supplier.name,
        grandTotal: grandTotal.toFixed(2),
        amountPaid: totalPaid.toFixed(2),
        balanceDue: balanceDue.toFixed(2),
        paymentStatus,
        itemCount: calculatedItems.length
      },
      ipAddress: ipAddress || null
    });

    const fullResult = {
      ...insertedPurchase,
      items: insertedLineItems,
      payments: insertedPayments
    };

    // K. Save Idempotency Key
    if (payload.idempotencyKey) {
      const requestHash = crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await tx.insert(schema.idempotencyKeys).values({
        key: payload.idempotencyKey,
        shopId,
        endpoint: '/api/v1/purchases',
        requestHash,
        responseStatusCode: '200',
        responseBody: fullResult,
        expiresAt
      });
    }

    return fullResult;
  });

  return createdPurchase;
}

export async function recordPurchasePayment(
  shopId: string,
  purchaseId: string,
  payload: PurchasePaymentInput & { idempotencyKey?: string },
  userId: string,
  userName: string,
  ipAddress?: string
) {
  const { db } = await getDatabase();

  const purchaseRows = await db
    .select()
    .from(schema.purchases)
    .where(and(eq(schema.purchases.id, purchaseId), eq(schema.purchases.shopId, shopId)))
    .limit(1);

  if (purchaseRows.length === 0) {
    throw new Error('Purchase invoice not found.');
  }
  const purchase = purchaseRows[0];

  const payAmt = new Decimal(payload.amount);
  if (payAmt.lessThanOrEqualTo(0)) {
    throw new Error('Payment amount must be greater than zero.');
  }

  const currentDue = new Decimal(purchase.balanceDue);
  if (payAmt.greaterThan(currentDue)) {
    throw new Error(`Payment amount (₹${payAmt.toFixed(2)}) exceeds balance due (₹${currentDue.toFixed(2)}).`);
  }

  return db.transaction(async (tx: any) => {
    // 1. Insert Payment Record
    const [pmt] = await tx
      .insert(schema.purchasePayments)
      .values({
        shopId,
        purchaseId: purchase.id,
        supplierId: purchase.supplierId,
        amount: payAmt.toFixed(2),
        mode: payload.mode,
        referenceNo: payload.referenceNo || null,
        notes: payload.notes || null,
        createdBy: userId,
        createdByName: userName
      })
      .returning();

    // 2. Update Purchase Balance
    const newPaid = new Decimal(purchase.amountPaid).plus(payAmt);
    const newDue = new Decimal(purchase.grandTotal).minus(newPaid);
    const newStatus = newDue.lessThanOrEqualTo(0) ? 'PAID' : 'PARTIALLY_PAID';

    await tx
      .update(schema.purchases)
      .set({
        amountPaid: newPaid.toFixed(2),
        balanceDue: newDue.toFixed(2),
        paymentStatus: newStatus,
        updatedAt: new Date()
      })
      .where(eq(schema.purchases.id, purchase.id));

    // 3. Post to Supplier Ledger (Debit)
    const supplierRows = await tx
      .select()
      .from(schema.suppliers)
      .where(eq(schema.suppliers.id, purchase.supplierId));

    if (supplierRows.length > 0) {
      const supp = supplierRows[0];
      const prevBal = new Decimal(supp.currentBalance || '0.00');
      const newBal = prevBal.minus(payAmt);

      await tx.insert(schema.supplierLedgerEntries).values({
        shopId,
        supplierId: supp.id,
        type: 'PAYMENT_OUT',
        referenceNo: payload.referenceNo || `PMT-${purchase.purchaseNumber}`,
        description: `Subsequent payment for Purchase #${purchase.purchaseNumber}`,
        credit: '0.00',
        debit: payAmt.toFixed(2),
        runningBalance: newBal.toFixed(2)
      });

      await tx
        .update(schema.suppliers)
        .set({
          currentBalance: newBal.toFixed(2),
          updatedAt: new Date()
        })
        .where(eq(schema.suppliers.id, supp.id));
    }

    // 4. Audit Trail
    await tx.insert(schema.auditLogs).values({
      shopId,
      actorId: userId,
      actorName: userName,
      actorRole: 'STAFF',
      action: 'PURCHASE_PAYMENT_RECORDED',
      entityName: 'PURCHASE',
      entityId: purchase.id,
      stateDiff: {
        paymentId: pmt.id,
        amount: payAmt.toFixed(2),
        mode: payload.mode,
        newBalanceDue: newDue.toFixed(2),
        newStatus
      },
      ipAddress: ipAddress || null
    });

    return pmt;
  });
}
