import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../server.js';
import { FastifyInstance } from 'fastify';
import { getDatabase } from '../db/connection.js';
import * as schema from '../db/schema/index.js';
import { eq } from 'drizzle-orm';
import { hashPassword, hashToken, hashPin } from '../services/crypto.js';
import { randomUUID } from 'crypto';
import {
  updateRateDefinition,
  getRateDefinitions,
  resolveCurrentRate,
  getRatesHistory
} from '../services/rates.service.js';
import { createItem } from '../services/items.service.js';
import { createInvoiceTransaction } from '../services/billing.service.js';
import { lookupItemWithQuote } from '../services/scan.service.js';

describe('Dynamic Metal Purity & Rate Management Suite (Rate Master)', () => {
  let app: FastifyInstance;
  let shopId: string;
  let shop2Id: string;
  let ownerId: string;
  let cashierId: string;
  let ownerToken: string;
  let cashierToken: string;

  beforeAll(async () => {
    app = await buildServer();
    await app.ready();
    const { db } = await getDatabase();

    // 1. Create Test Shop 1
    shopId = randomUUID();
    await db.insert(schema.shops).values({
      id: shopId,
      name: 'Kamal Jewellers Test Flagship',
      code: 'KJ-TEST-RATES-' + Date.now().toString().slice(-4),
      address: '101 Zaveri Bazaar, Mumbai',
      defaultTaxPercent: '3.00'
    });

    // Create Test Shop 2 (Cross-tenant testing)
    shop2Id = randomUUID();
    await db.insert(schema.shops).values({
      id: shop2Id,
      name: 'Other Jewellers Shop',
      code: 'OJ-TEST-' + Date.now().toString().slice(-4),
      address: '202 Jewel Square, Pune',
      defaultTaxPercent: '3.00'
    });

    // 2. Create Owner User (ADMIN) & Cashier User (CLERK)
    ownerId = randomUUID();
    const pwHash = await hashPassword('OwnerPass123!');
    const ownerPinHash = await hashPin('1234');
    await db.insert(schema.users).values({
      id: ownerId,
      shopId,
      name: 'Kamal Kishore Soni',
      email: `owner-rates-${Date.now()}@kamaljewellers.com`,
      passwordHash: pwHash,
      pinHash: ownerPinHash,
      role: 'ADMIN',
      isActive: true
    });

    cashierId = randomUUID();
    await db.insert(schema.users).values({
      id: cashierId,
      shopId,
      name: 'Ramesh Clerk',
      email: `cashier-rates-${Date.now()}@kamaljewellers.com`,
      passwordHash: pwHash,
      role: 'CLERK',
      isActive: true
    });

    // 3. Create Sessions
    ownerToken = 'owner_tok_' + randomUUID();
    await db.insert(schema.sessions).values({
      id: randomUUID(),
      userId: ownerId,
      shopId,
      tokenHash: hashToken(ownerToken),
      expiresAt: new Date(Date.now() + 86400000)
    });

    cashierToken = 'cashier_tok_' + randomUUID();
    await db.insert(schema.sessions).values({
      id: randomUUID(),
      userId: cashierId,
      shopId,
      tokenHash: hashToken(cashierToken),
      expiresAt: new Date(Date.now() + 86400000)
    });
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  // TEST 1: Create custom Gold 20K (833) rate definition
  it('TEST 1: Owner can create custom Gold 20K rate definition', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/rates/definitions',
      cookies: { pos_session: ownerToken },
      payload: {
        metal: 'Gold',
        purity: '20K',
        fineness: 833,
        currentRate: '6125.00',
        isActive: true
      }
    });

    expect(res.statusCode).toBe(201);
    const json = JSON.parse(res.payload);
    expect(json.success).toBe(true);
    expect(json.data.metal).toBe('GOLD');
    expect(json.data.purity).toBe('20K');
    expect(json.data.fineness).toBe(833);
    expect(json.data.currentRate).toBe('6125.00');
  });

  // TEST 2: Create custom Gold 19K (792) rate definition
  it('TEST 2: Owner can create custom Gold 19K rate definition', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/rates/definitions',
      cookies: { pos_session: ownerToken },
      payload: {
        metal: 'Gold',
        purity: '19K',
        fineness: 792,
        currentRate: '5900.00',
        isActive: true
      }
    });

    expect(res.statusCode).toBe(201);
    const json = JSON.parse(res.payload);
    expect(json.success).toBe(true);
    expect(json.data.purity).toBe('19K');
    expect(json.data.fineness).toBe(792);
    expect(json.data.currentRate).toBe('5900.00');
  });

  // TEST 3: Duplicate Gold 20K/833 is rejected with 409 Conflict
  it('TEST 3: Duplicate Gold 20K / 833 definition is rejected with 409 Conflict', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/rates/definitions',
      cookies: { pos_session: ownerToken },
      payload: {
        metal: 'Gold',
        purity: '20K',
        fineness: 833,
        currentRate: '6200.00'
      }
    });

    expect(res.statusCode).toBe(409);
    const json = JSON.parse(res.payload);
    expect(json.success).toBe(false);
    expect(json.error.message).toContain('already exists');
  });

  // TEST 4: Update Gold 20K rate to new value
  it('TEST 4: Owner can update Gold 20K rate', async () => {
    const defs = await getRateDefinitions(shopId);
    const def20k = defs.find((d) => d.purity === '20K')!;

    const res = await app.inject({
      method: 'PUT',
      url: `/api/v1/rates/definitions/${def20k.id}`,
      cookies: { pos_session: ownerToken },
      payload: {
        currentRate: '6300.00'
      }
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.payload);
    expect(json.success).toBe(true);
    expect(json.data.currentRate).toBe('6300.00');
  });

  // TEST 5: Previous rate remains in immutable rate history
  it('TEST 5: Previous rate is preserved in immutable rate history', async () => {
    const history = await getRatesHistory(shopId);
    const updateEvent = history.find((h) => h.purity === '20K' && h.action === 'RATE_UPDATED');

    expect(updateEvent).toBeDefined();
    expect(updateEvent?.previousRate).toBe('6125.00');
    expect(updateEvent?.newRate).toBe('6300.00');
  });

  // TEST 6: Deactivate a purity; cannot be selected for new pricing calculations
  it('TEST 6: Deactivating a purity prevents it from being used for new pricing calculations', async () => {
    const defs = await getRateDefinitions(shopId);
    const def19k = defs.find((d) => d.purity === '19K')!;

    // Deactivate 19K
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/rates/definitions/${def19k.id}/status`,
      cookies: { pos_session: ownerToken },
      payload: { isActive: false }
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.payload);
    expect(json.data.isActive).toBe(false);

    // Resolving deactivated purity must throw explicit error
    await expect(
      resolveCurrentRate(shopId, { metal: 'GOLD', purity: '19K' })
    ).rejects.toThrow(/Rate definition is not configured or inactive/);
  });

  // TEST 7: Inventory item using Gold 20K resolves correct active rate
  it('TEST 7: Creating an inventory item with Gold 20K resolves correct active rate', async () => {
    const item = await createItem(shopId, {
      itemCode: 'KJ-TEST-20K-ITEM',
      designTitle: '20K Antique Bracelet',
      category: 'Bangles',
      metal: 'GOLD',
      purity: '20K',
      grossWeight: '10.000',
      stoneWeight: '0.000',
      makingChargeType: 'PER_GRAM',
      makingChargeValue: '400.00',
      wastagePct: '1.00',
      stoneValue: '0.00'
    });

    expect(item).toBeDefined();
    expect(item.purity).toBe('20K');
    expect(item.fineness).toBe(833);
  });

  // TEST 8: Barcode / Quote lookup for Gold 20K item applies accurate rate
  it('TEST 8: lookupItemWithQuote applies accurate Gold 20K rate', async () => {
    const quote = await lookupItemWithQuote(shopId, 'KJ-TEST-20K-ITEM');

    expect(quote).toBeDefined();
    expect(quote.breakdown.rateApplied).toBe('6300.00');
    expect(quote.breakdown.baseMetalValue).toBe('63000.00'); // 10.000g * 6300.00
    expect(quote.breakdown.makingCharges).toBe('4000.00'); // 10.000g * 400.00
    expect(quote.breakdown.wastageValue).toBe('630.00'); // 1% of 63000
    expect(quote.breakdown.taxableAmount).toBe('67630.00'); // 63000 + 4000 + 630
    expect(quote.breakdown.taxAmount).toBe('2028.90'); // 3% of 67630
    expect(quote.breakdown.totalAmount).toBe('69658.90');
  });

  // TEST 9: Manual Item Code lookup via API returns same accurate quote
  it('TEST 9: Manual Item Code lookup via GET /scan/lookup returns accurate quote', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/scan/lookup?code=KJ-TEST-20K-ITEM',
      cookies: { pos_session: ownerToken }
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.payload);
    expect(json.success).toBe(true);
    expect(json.data.breakdown.rateApplied).toBe('6300.00');
    expect(json.data.breakdown.totalAmount).toBe('69658.90');
  });

  // TEST 10 & 11: Finalized bill snapshots rate; changing daily rate tomorrow does not modify old bill
  it('TEST 10 & 11: Finalized bill permanently snapshots applied rate and is not affected by future rate changes', async () => {
    // A. Create Bill 1 with rate 6300.00
    const invoice1 = await createInvoiceTransaction(
      {
        customerName: 'Smt. Ananya Verma',
        customerMobile: '9820011223',
        items: [
          {
            itemCode: 'KJ-TEST-20K-ITEM',
            designTitle: '20K Antique Bracelet',
            metal: 'GOLD',
            purity: '20K',
            grossWeight: '10.000',
            netWeight: '10.000',
            rateApplied: '6300.00',
            masterRate: '6300.00',
            makingChargeValue: '400.00',
            wastagePct: '1.00'
          }
        ],
        payments: [{ mode: 'UPI', amount: '69658.90' }]
      },
      ownerId,
      'Kamal Kishore Soni',
      shopId
    );

    expect(invoice1).toBeDefined();
    expect(invoice1.items[0].boardRate).toBe('6300.00');
    expect(invoice1.grandTotal).toBe('69658.90');

    // B. Tomorrow Owner changes Gold 20K rate to 6500.00
    const defs = await getRateDefinitions(shopId);
    const def20k = defs.find((d) => d.purity === '20K')!;
    await updateRateDefinition(shopId, def20k.id, { currentRate: '6500.00' }, ownerId, 'Kamal Kishore Soni');

    // C. Verify Old Invoice line item still shows 6300.00 and 69658.90
    const { db } = await getDatabase();
    const [fetchedOldInvoice] = await db
      .select()
      .from(schema.invoices)
      .where(eq(schema.invoices.id, invoice1.id));
    const oldItems = await db
      .select()
      .from(schema.invoiceItems)
      .where(eq(schema.invoiceItems.invoiceId, invoice1.id));

    expect(fetchedOldInvoice.grandTotal).toBe('69658.90');
    expect(oldItems[0].boardRate).toBe('6300.00');
    expect(oldItems[0].metalValue).toBe('63000.00');

    // D. Create New Item & Bill 2 using today's rate 6500.00
    const item2 = await createItem(shopId, {
      itemCode: 'KJ-TEST-20K-ITEM-2',
      designTitle: '20K Pendant',
      category: 'Pendant',
      metal: 'GOLD',
      purity: '20K',
      grossWeight: '5.000',
      stoneWeight: '0.000'
    });

    const quote2 = await lookupItemWithQuote(shopId, item2.itemCode);
    expect(quote2.breakdown.rateApplied).toBe('6500.00');
  });

  // TEST 12 & 13: Item-specific rate override applies only to transaction and does NOT mutate master rate
  it('TEST 12 & 13: Item-specific rate override applies only to transaction and does not mutate master rate', async () => {
    // Master rate for 20K is 6500.00
    // Negotiated discount rate: 6400.00
    const invoiceOverride = await createInvoiceTransaction(
      {
        customerName: 'Shri Vikram Mehta',
        customerMobile: '9819922334',
        items: [
          {
            itemCode: 'KJ-TEST-20K-OVERRIDE',
            designTitle: '20K Custom Chain',
            metal: 'GOLD',
            purity: '20K',
            grossWeight: '10.000',
            netWeight: '10.000',
            rateApplied: '6400.00', // Applied Override Rate
            masterRate: '6500.00', // Master Showroom Rate
            isRateOverridden: true,
            overrideReason: 'Special wedding customer negotiated rate',
            makingChargeValue: '0.00',
            wastagePct: '0.00'
          }
        ],
        payments: [{ mode: 'CASH', amount: '65920.00' }] // (64000 + 3% GST = 65920.00)
      },
      ownerId,
      'Kamal Kishore Soni',
      shopId
    );

    expect(invoiceOverride.items[0].boardRate).toBe('6400.00');
    expect(invoiceOverride.items[0].masterRate).toBe('6500.00');
    expect(invoiceOverride.items[0].isRateOverridden).toBe(true);
    expect(invoiceOverride.items[0].overrideReason).toBe('Special wedding customer negotiated rate');

    // Verify master rate in Rate Master is UNCHANGED (still 6500.00)
    const defs = await getRateDefinitions(shopId);
    const def20k = defs.find((d) => d.purity === '20K')!;
    expect(def20k.currentRate).toBe('6500.00');
  });

  // TEST 14: Return transaction preserves original applicable rate
  it('TEST 14: Return transaction preserves original invoice rate', async () => {
    // Create an item and sell it
    const itemRet = await createItem(shopId, {
      itemCode: 'KJ-RET-ITEM-1',
      designTitle: '22K Ring for Return Test',
      category: 'Rings',
      metal: 'GOLD',
      purity: '22K',
      grossWeight: '4.000'
    });

    const invoice = await createInvoiceTransaction(
      {
        customerName: 'Return Test Customer',
        customerMobile: '9988776655',
        items: [
          {
            itemId: itemRet.id,
            itemCode: itemRet.itemCode,
            designTitle: itemRet.designTitle,
            metal: 'GOLD',
            purity: '22K',
            grossWeight: '4.000',
            netWeight: '4.000',
            rateApplied: '6980.00',
            masterRate: '6980.00',
            makingChargeValue: '400.00',
            wastagePct: '0.00'
          }
        ],
        payments: [{ mode: 'UPI', amount: '30406.40' }] // (4*6980=27920 + 1600 mk = 29520 + 3% = 30406.40)
      },
      ownerId,
      'Kamal Kishore Soni',
      shopId
    );

    // Process Return
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/returns',
      cookies: { pos_session: ownerToken },
      payload: {
        originalInvoiceNumber: invoice.invoiceNumber,
        itemCode: itemRet.itemCode,
        returnReason: 'Customer changed mind',
        refundAmount: '30406.40',
        deductionAmount: '0.00',
        restockDestination: 'BACK_TO_STOCK',
        supervisorPin: '1234'
      }
    });

    expect(res.statusCode).toBe(201);
    const json = JSON.parse(res.payload);
    expect(json.success).toBe(true);
    expect(json.data.refundAmount).toBe('30406.40');
  });

  // TEST 15: Cross-tenant rate access is rejected
  it('TEST 15: Cross-tenant rate definition modification is rejected', async () => {
    // Get a rate from Shop 1
    const defs1 = await getRateDefinitions(shopId);
    const def1 = defs1[0]!;

    // Attempt to update Shop 1 rate using Shop 2 owner token
    const { db } = await getDatabase();
    const [shop2Owner] = await db
      .insert(schema.users)
      .values({
        shopId: shop2Id,
        name: 'Shop 2 Owner',
        email: `owner-shop2-${Date.now()}@example.com`,
        passwordHash: 'dummy_hash',
        role: 'ADMIN',
        isActive: true
      })
      .returning();

    const shop2Token = 'shop2_tok_' + randomUUID();
    await db.insert(schema.sessions).values({
      id: randomUUID(),
      userId: shop2Owner.id,
      shopId: shop2Id,
      tokenHash: hashToken(shop2Token),
      expiresAt: new Date(Date.now() + 86400000)
    });

    const res = await app.inject({
      method: 'PUT',
      url: `/api/v1/rates/definitions/${def1.id}`,
      cookies: { pos_session: shop2Token },
      payload: { currentRate: '9999.00' }
    });

    expect(res.statusCode).toBe(404);
  });

  // TEST 16: Unauthorized cashier cannot modify master rate definitions or publish rates
  it('TEST 16: Unauthorized cashier cannot modify master rate definitions or publish rates', async () => {
    const defs = await getRateDefinitions(shopId);
    const def1 = defs[0]!;

    const res = await app.inject({
      method: 'PUT',
      url: `/api/v1/rates/definitions/${def1.id}`,
      cookies: { pos_session: cashierToken },
      payload: { currentRate: '1000.00' }
    });

    expect(res.statusCode).toBe(403);
  });

  // TEST 17: Rate audit entries created with before/after state diff
  it('TEST 17: Rate audit entries created in audit_logs', async () => {
    const { db } = await getDatabase();
    const logs = await db
      .select()
      .from(schema.auditLogs)
      .where(eq(schema.auditLogs.shopId, shopId));

    const rateLogs = logs.filter((l: any) => l.action.startsWith('RATE_'));
    expect(rateLogs.length).toBeGreaterThan(0);
  });

  // TEST 18: Invalid negative rate rejected
  it('TEST 18: Invalid negative rate is rejected by schema validation', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/rates/definitions',
      cookies: { pos_session: ownerToken },
      payload: {
        metal: 'Gold',
        purity: '10K',
        fineness: 417,
        currentRate: '-500.00'
      }
    });

    expect(res.statusCode).toBe(400);
  });

  // TEST 19: Invalid purity/fineness rejected
  it('TEST 19: Invalid fineness > 1000 is rejected by schema validation', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/rates/definitions',
      cookies: { pos_session: ownerToken },
      payload: {
        metal: 'Gold',
        purity: '25K',
        fineness: 1500,
        currentRate: '7500.00'
      }
    });

    expect(res.statusCode).toBe(400);
  });

  // TEST 20: All existing rate definitions and bulk publishing work end-to-end
  it('TEST 20: Bulk publishing updates all active rate definitions and logs history', async () => {
    const defs = await getRateDefinitions(shopId, false);
    const updates = defs.slice(0, 3).map((d) => ({
      id: d.id,
      rate: (parseFloat(d.currentRate) + 50).toFixed(2)
    }));

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/rates/publish',
      cookies: { pos_session: ownerToken },
      payload: { rates: updates }
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.payload);
    expect(json.success).toBe(true);
    expect(json.data.length).toBe(updates.length);
  });
});
