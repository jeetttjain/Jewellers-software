import { describe, it, expect, beforeEach } from 'vitest';
import { getDatabase, initDatabase } from '../db/connection.js';
import * as schema from '../db/schema/index.js';
import { eq, desc } from 'drizzle-orm';
import {
  publishDailyRates,
  getRatesHistory,
  getHistoricalRate,
  getRateDefinitions,
  resolveCurrentRate
} from '../services/rates.service.js';
import { createInvoiceTransaction, getInvoiceById } from '../services/billing.service.js';
import { createPurchaseTransaction } from '../services/purchases.service.js';
import { createSupplier } from '../services/suppliers.service.js';
import { PaymentMode } from '@jewellery-pos/shared';

describe('Rate Versioning & Historical Rate Audit Engine', () => {
  let shopId: string;
  let adminUserId: string;

  beforeEach(async () => {
    process.env['NODE_ENV'] = 'test';
    process.env['VITEST'] = 'true';
    const { db } = await getDatabase();
    await initDatabase(db);

    // Create unique test shop & admin user
    const randId = Math.floor(10000000 + Math.random() * 90000000).toString();
    const uniquePrefix = `I${randId.slice(0, 4)}/`;
    const [shop] = await db
      .insert(schema.shops)
      .values({
        name: 'Royal Heritage Jewellers Audit Test',
        code: `R${randId.slice(0, 8)}`,
        address: '100 Johari Bazar, Jaipur',
        gstin: '08AAAAA0000A1Z5',
        invoicePrefix: uniquePrefix
      })
      .returning();
    shopId = shop.id;

    const [user] = await db
      .insert(schema.users)
      .values({
        shopId,
        name: 'Kamal Kishore Soni',
        email: `kamal-${Date.now()}-${Math.floor(Math.random() * 1000)}@heritage.com`,
        passwordHash: 'hash123',
        role: 'ADMIN'
      })
      .returning();
    adminUserId = user.id;
  });

  it('Requirement 1 & 2 & 3 & 4: Rate ₹6,980 creates invoice with ₹6,980 snapshot; future rate change to ₹7,250 never modifies old invoice; new transactions use ₹7,250', async () => {
    const { db } = await getDatabase();

    // 1. Configure initial rate for 22K Gold at ₹6,980
    const defs = await getRateDefinitions(shopId, true);
    const def22k = defs.find((d) => d.metal === 'GOLD' && d.purity === '22K')!;
    expect(def22k).toBeDefined();

    await publishDailyRates(
      shopId,
      [{ id: def22k.id, rate: '6980.00' }],
      adminUserId,
      'Kamal Kishore Soni',
      'Initial 21 Aug Board Rate'
    );

    // 2. Create customer and inventory item
    const [customer] = await db
      .insert(schema.customers)
      .values({
        shopId,
        name: 'Vikramaditya Rathore',
        mobile: '9829012345'
      })
      .returning();

    const [item] = await db
      .insert(schema.jewelleryItems)
      .values({
        shopId,
        itemCode: `22K-BRC-${Date.now()}`,
        category: 'BRACELET',
        designTitle: '22K Rajwadi Kada',
        metal: 'GOLD',
        purity: '22K',
        fineness: 916,
        grossWeight: '28.350',
        stoneWeight: '0.500',
        netWeight: '27.850',
        makingChargeValue: '13925.00',
        makingChargeType: 'FLAT',
        wastagePct: '2.00',
        status: 'IN_STOCK'
      })
      .returning();

    // 3. Create invoice with 22K rate snapshot @ ₹6,980
    // Valuation: Net wt 27.850 * 6980 = 194393.00
    // Wastage: 2% of 194393 = 3887.86
    // Making: 13925.00
    // Taxable: 194393 + 3887.86 + 13925 = 212205.86
    // GST 3%: 6366.18
    // Total: 218572.04
    const invoice1 = await createInvoiceTransaction(
      {
        customerId: customer.id,
        customerName: 'Vikramaditya Rathore',
        customerMobile: '9829012345',
        customerPan: 'ABCDE1234F',
        items: [
          {
            itemCode: item.itemCode,
            designTitle: item.designTitle,
            metal: item.metal,
            purity: item.purity,
            fineness: item.fineness,
            grossWeight: item.grossWeight,
            stoneWeight: item.stoneWeight,
            netWeight: item.netWeight,
            rateApplied: '6980.00',
            masterRate: '6980.00',
            makingChargeType: 'FLAT',
            makingChargeValue: '13925.00',
            makingCharges: '13925.00',
            wastagePct: '2.00',
            discount: '0.00'
          }
        ],
        payments: [
          {
            mode: 'BANK_TRANSFER',
            amount: '218572.04'
          }
        ]
      },
      adminUserId,
      'Kamal Kishore Soni',
      shopId
    );

    expect(invoice1.grandTotal).toBe('218572.04');
    expect(invoice1.taxableAmount).toBe('212205.86');
    expect(invoice1.totalTaxAmount).toBe('6366.18');
    expect(invoice1.items[0].boardRate).toBe('6980.00');

    // 4. Rate increases on 25 Aug to ₹7,250
    await publishDailyRates(
      shopId,
      [{ id: def22k.id, rate: '7250.00' }],
      adminUserId,
      'Kamal Kishore Soni',
      '25 Aug Bullion Hike'
    );

    // Verify latest showroom master rate is now ₹7,250
    const resolvedNewRate = await resolveCurrentRate(shopId, { metal: 'GOLD', purity: '22K' });
    expect(resolvedNewRate.rate).toBe('7250.00');

    // 5. Verify the historical invoice STILL evaluates to exact ₹6,980 snapshot and original totals
    const fetchedOldInvoice = await getInvoiceById(shopId, invoice1.id);
    expect(fetchedOldInvoice).toBeDefined();
    expect(fetchedOldInvoice!.grandTotal).toBe('218572.04');
    expect(fetchedOldInvoice!.taxableAmount).toBe('212205.86');
    expect(fetchedOldInvoice!.totalTaxAmount).toBe('6366.18');
    expect(fetchedOldInvoice!.items[0].boardRate).toBe('6980.00');

    // 6. Create a NEW item and invoice using the new rate ₹7,250
    const [item2] = await db
      .insert(schema.jewelleryItems)
      .values({
        shopId,
        itemCode: `22K-RNG-${Date.now()}`,
        category: 'RING',
        designTitle: '22K Solitaire Ring',
        metal: 'GOLD',
        purity: '22K',
        fineness: 916,
        grossWeight: '10.000',
        stoneWeight: '0.000',
        netWeight: '10.000',
        makingChargeValue: '2500.00',
        makingChargeType: 'FLAT',
        wastagePct: '0.00',
        status: 'IN_STOCK'
      })
      .returning();

    // 10g * 7250 = 72500 + 2500 = 75000 + 3% GST (2250) = 77250
    const invoice2 = await createInvoiceTransaction(
      {
        customerId: customer.id,
        customerName: 'Vikramaditya Rathore',
        customerMobile: '9829012345',
        items: [
          {
            itemCode: item2.itemCode,
            designTitle: item2.designTitle,
            metal: item2.metal,
            purity: item2.purity,
            fineness: item2.fineness,
            grossWeight: item2.grossWeight,
            stoneWeight: item2.stoneWeight,
            netWeight: item2.netWeight,
            rateApplied: resolvedNewRate.rate, // 7250.00
            masterRate: resolvedNewRate.rate,
            makingChargeType: 'FLAT',
            makingChargeValue: '2500.00',
            makingCharges: '2500.00',
            wastagePct: '0.00',
            discount: '0.00'
          }
        ],
        payments: [
          {
            mode: 'CASH',
            amount: '77250.00'
          }
        ]
      },
      adminUserId,
      'Kamal Kishore Soni',
      shopId
    );

    expect(invoice2.grandTotal).toBe('77250.00');
    expect(invoice2.items[0].boardRate).toBe('7250.00');
  });

  it('Requirement 5: Multiple rate changes on the same day are all preserved with timestamp and reasons', async () => {
    const defs = await getRateDefinitions(shopId, true);
    const def24k = defs.find((d) => d.metal === 'GOLD' && d.purity === '24K')!;

    // Rate Change 1 (Morning @ 10:00 AM)
    await publishDailyRates(
      shopId,
      [{ id: def24k.id, rate: '7400.00' }],
      adminUserId,
      'Kamal Kishore Soni',
      'Morning MCX Open'
    );

    // Rate Change 2 (Noon @ 01:00 PM)
    await publishDailyRates(
      shopId,
      [{ id: def24k.id, rate: '7450.00' }],
      adminUserId,
      'Kamal Kishore Soni',
      'Midday Bullion Rally'
    );

    // Rate Change 3 (Evening @ 05:00 PM)
    await publishDailyRates(
      shopId,
      [{ id: def24k.id, rate: '7480.00' }],
      adminUserId,
      'Kamal Kishore Soni',
      'Evening Market Close'
    );

    const history = await getRatesHistory(shopId, { metal: 'GOLD', purity: '24K' });
    expect(history.length).toBeGreaterThanOrEqual(3);

    // Ordered chronologically descending
    const ratesInHistory = history.map((h) => h.newRate);
    expect(ratesInHistory.slice(0, 3)).toEqual(['7480.00', '7450.00', '7400.00']);

    // Reasons preserved
    const reasons = history.map((h) => h.changeReason);
    expect(reasons).toContain('Morning MCX Open');
    expect(reasons).toContain('Midday Bullion Rally');
    expect(reasons).toContain('Evening Market Close');
  });

  it('Requirement 6: Historical rate lookup returns the exact rate for a requested past date/time', async () => {
    const { db } = await getDatabase();
    const defs = await getRateDefinitions(shopId, true);
    const defSilver = defs.find((d) => d.metal === 'SILVER' && d.purity === '999')!;

    // Insert historical rate transitions with explicit past timestamps
    const pastTime1 = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000); // 10 days ago
    const pastTime2 = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);  // 5 days ago
    const pastTime3 = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000);  // 1 day ago

    await db.insert(schema.rateHistory).values({
      shopId,
      rateDefinitionId: defSilver.id,
      metal: 'SILVER',
      purity: '999',
      fineness: 999,
      previousRate: '80.00',
      newRate: '85.00',
      action: 'RATE_UPDATED',
      changedBy: adminUserId,
      changedByName: 'Kamal Kishore Soni',
      changeReason: '10 Days Ago Rate',
      effectiveFrom: pastTime1,
      createdAt: pastTime1
    });

    await db.insert(schema.rateHistory).values({
      shopId,
      rateDefinitionId: defSilver.id,
      metal: 'SILVER',
      purity: '999',
      fineness: 999,
      previousRate: '85.00',
      newRate: '88.50',
      action: 'RATE_UPDATED',
      changedBy: adminUserId,
      changedByName: 'Kamal Kishore Soni',
      changeReason: '5 Days Ago Rate',
      effectiveFrom: pastTime2,
      createdAt: pastTime2
    });

    await db.insert(schema.rateHistory).values({
      shopId,
      rateDefinitionId: defSilver.id,
      metal: 'SILVER',
      purity: '999',
      fineness: 999,
      previousRate: '88.50',
      newRate: '92.00',
      action: 'RATE_UPDATED',
      changedBy: adminUserId,
      changedByName: 'Kamal Kishore Soni',
      changeReason: 'Yesterday Rate',
      effectiveFrom: pastTime3,
      createdAt: pastTime3
    });

    // Query rate as of 7 days ago (Between pastTime1 and pastTime2) -> Should be ₹85.00
    const queryDate7DaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const lookup7DaysAgo = await getHistoricalRate(shopId, {
      metal: 'SILVER',
      purity: '999',
      asOfDate: queryDate7DaysAgo
    });
    expect(lookup7DaysAgo.rate).toBe('85.00');
    expect(lookup7DaysAgo.isExactHistoricalMatch).toBe(true);
    expect(lookup7DaysAgo.changeReason).toBe('10 Days Ago Rate');

    // Query rate as of 3 days ago (Between pastTime2 and pastTime3) -> Should be ₹88.50
    const queryDate3DaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const lookup3DaysAgo = await getHistoricalRate(shopId, {
      metal: 'SILVER',
      purity: '999',
      asOfDate: queryDate3DaysAgo
    });
    expect(lookup3DaysAgo.rate).toBe('88.50');
    expect(lookup3DaysAgo.isExactHistoricalMatch).toBe(true);
    expect(lookup3DaysAgo.changeReason).toBe('5 Days Ago Rate');

    // Query rate as of Right Now -> Should be ₹92.00
    const lookupNow = await getHistoricalRate(shopId, {
      metal: 'SILVER',
      purity: '999',
      asOfDate: new Date()
    });
    expect(lookupNow.rate).toBe('92.00');
  });

  it('Requirement 8: Purchase transactions are NOT recalculated when showroom selling rates change', async () => {
    // 1. Create a supplier
    const supplier = await createSupplier(
      shopId,
      {
        name: 'Jaipur Bullion Refiners',
        supplierCode: `SUP-${Date.now().toString().slice(-6)}`,
        mobile: '9828001122',
        address: 'Johari Bazar, Jaipur',
        gstin: '08ABCDE1234F1Z5'
      },
      adminUserId
    );

    // 2. Create Purchase at wholesale rate ₹6,500/g
    const purchase = await createPurchaseTransaction(
      shopId,
      {
        supplierId: supplier.id,
        supplierInvoiceNumber: `PUR-${Date.now()}`,
        purchaseDate: new Date().toISOString(),
        items: [
          {
            itemCode: `RAW-22K-${Date.now()}`,
            category: 'RAW_MATERIAL',
            designTitle: '22K Gold Bullion Ingot',
            metal: 'GOLD',
            purity: '22K',
            grossWeight: '100.000',
            netWeight: '100.000',
            purchaseRate: '6500.00',
            metalCost: '650000.00',
            makingRate: '50.00',
            makingCost: '5000.00',
            taxableAmount: '655000.00',
            taxAmount: '19650.00',
            finalAmount: '674650.00'
          }
        ],
        payments: [
          {
            mode: 'BANK_TRANSFER',
            amount: '674650.00'
          }
        ]
      },
      adminUserId,
      'Kamal Kishore Soni'
    );

    expect(purchase.grandTotal).toBe('674650.00');

    // 3. Showroom selling rates change drastically to ₹8,000/g
    const defs = await getRateDefinitions(shopId, true);
    const def22k = defs.find((d) => d.metal === 'GOLD' && d.purity === '22K')!;
    await publishDailyRates(
      shopId,
      [{ id: def22k.id, rate: '8000.00' }],
      adminUserId,
      'Kamal Kishore Soni',
      'Surge Update'
    );

    // 4. Verify supplier purchase record remains fixed at ₹6,500/g and ₹674,650
    const { db } = await getDatabase();
    const [fetchedPurchase] = await db
      .select()
      .from(schema.purchases)
      .where(eq(schema.purchases.id, purchase.id));

    expect(fetchedPurchase.grandTotal).toBe('674650.00');
    expect(fetchedPurchase.taxableAmount).toBe('655000.00');
  });

  it('Requirement 9: Monetary calculations contain ZERO NaN, undefined, or Infinity values', async () => {
    const history = await getRatesHistory(shopId);
    for (const h of history) {
      expect(Number.isFinite(parseFloat(h.newRate))).toBe(true);
      if (h.previousRate) {
        expect(Number.isFinite(parseFloat(h.previousRate))).toBe(true);
      }
    }

    const defs = await getRateDefinitions(shopId, true);
    for (const d of defs) {
      expect(Number.isFinite(parseFloat(d.currentRate))).toBe(true);
      expect(parseFloat(d.currentRate)).toBeGreaterThanOrEqual(0);
    }
  });

  it('Requirement 10: Custom/unbarcoded piece resolves active Rate Master rate dynamically; rate updates affect only NEW transactions while preserving historical records', async () => {
    const { db } = await getDatabase();
    // 1. Set Rate Master for 22K Gold to ₹7,100
    const defs = await getRateDefinitions(shopId, true);
    const def22k = defs.find((d) => d.metal === 'GOLD' && d.purity === '22K')!;
    await publishDailyRates(
      shopId,
      [{ id: def22k.id, rate: '7100.00' }],
      adminUserId,
      'Kamal Kishore Soni',
      'Custom Item Rate Baseline'
    );

    // Resolve rate from rate master
    const rate1 = await resolveCurrentRate(shopId, { metal: 'GOLD', purity: '22K' });
    expect(rate1.rate).toBe('7100.00');

    // 2. Create customer and custom unbarcoded order piece using resolved rate ₹7,100
    const [cust] = await db
      .insert(schema.customers)
      .values({
        shopId,
        name: 'Kishore Kanwar',
        mobile: '9829012345'
      })
      .returning();

    // 10g * 7100 = 71000 + 4500 (Making) = 75500 + 3% GST (2265) = 77765
    const customInvoice1 = await createInvoiceTransaction(
      {
        customerId: cust.id,
        customerName: 'Kishore Kanwar',
        customerMobile: '9829012345',
        items: [
          {
            itemCode: 'CUSTOM-22K-ORDER-1',
            designTitle: 'Custom 22K Handcrafted Kada',
            metal: 'GOLD',
            purity: '22K',
            fineness: 916,
            grossWeight: '10.000',
            stoneWeight: '0.000',
            netWeight: '10.000',
            rateApplied: rate1.rate, // 7100.00
            masterRate: rate1.rate,
            makingChargeType: 'FLAT',
            makingChargeValue: '4500.00',
            makingCharges: '4500.00',
            wastagePct: '0.00',
            discount: '0.00'
          }
        ],
        payments: [
          {
            mode: 'BANK_TRANSFER',
            amount: '77765.00'
          }
        ]
      },
      adminUserId,
      'Kamal Kishore Soni',
      shopId
    );

    expect(customInvoice1.grandTotal).toBe('77765.00');
    expect(customInvoice1.items[0].boardRate).toBe('7100.00');

    // 3. Rate master increases to ₹7,500/g
    await publishDailyRates(
      shopId,
      [{ id: def22k.id, rate: '7500.00' }],
      adminUserId,
      'Kamal Kishore Soni',
      'Rate Hike to 7500'
    );

    const rate2 = await resolveCurrentRate(shopId, { metal: 'GOLD', purity: '22K' });
    expect(rate2.rate).toBe('7500.00');

    // 4. Create NEW custom order piece with updated rate ₹7,500
    // 10g * 7500 = 75000 + 4500 (Making) = 79500 + 3% GST (2385) = 81885
    const customInvoice2 = await createInvoiceTransaction(
      {
        customerId: cust.id,
        customerName: 'Kishore Kanwar',
        customerMobile: '9829012345',
        items: [
          {
            itemCode: 'CUSTOM-22K-ORDER-2',
            designTitle: 'Custom 22K Handcrafted Kada v2',
            metal: 'GOLD',
            purity: '22K',
            fineness: 916,
            grossWeight: '10.000',
            stoneWeight: '0.000',
            netWeight: '10.000',
            rateApplied: rate2.rate, // 7500.00
            masterRate: rate2.rate,
            makingChargeType: 'FLAT',
            makingChargeValue: '4500.00',
            makingCharges: '4500.00',
            wastagePct: '0.00',
            discount: '0.00'
          }
        ],
        payments: [
          {
            mode: 'BANK_TRANSFER',
            amount: '81885.00'
          }
        ]
      },
      adminUserId,
      'Kamal Kishore Soni',
      shopId
    );

    expect(customInvoice2.grandTotal).toBe('81885.00');
    expect(customInvoice2.items[0].boardRate).toBe('7500.00');

    // 5. Verify the historical customInvoice1 remains STRICTLY UNCHANGED at ₹7,100 & ₹77,765
    const fetchedOldCustomInvoice = await getInvoiceById(shopId, customInvoice1.id);
    expect(fetchedOldCustomInvoice!.grandTotal).toBe('77765.00');
    expect(fetchedOldCustomInvoice!.items[0].boardRate).toBe('7100.00');
  });
});
