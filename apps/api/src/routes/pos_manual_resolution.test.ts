import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../server.js';
import { FastifyInstance } from 'fastify';
import { getDatabase } from '../db/connection.js';
import * as schema from '../db/schema/index.js';
import { hashPassword, hashToken } from '../services/crypto.js';
import { randomUUID } from 'crypto';

describe('POS BILLING WHITE-SCREEN FIX & MANUAL ITEM RESOLUTION FALLBACK TEST SUITE', () => {
  let app: FastifyInstance;
  let shopAId: string;
  let shopBId: string;
  let ownerAUserId: string;
  let ownerAToken: string;
  let ownerACookie: string;
  let inStockItemId: string;
  let soldItemId: string;
  let incompleteItemId: string;
  let shopBItemId: string;

  beforeAll(async () => {
    app = await buildServer();
    await app.ready();
    const { db } = await getDatabase();

    shopAId = randomUUID();
    shopBId = randomUUID();

    await db.insert(schema.shops).values([
      { id: shopAId, name: 'POS Test Shop A', code: `POSTA_${Date.now()}`, address: 'Jewellery Hub A' },
      { id: shopBId, name: 'POS Test Shop B', code: `POSTB_${Date.now()}`, address: 'Jewellery Hub B' }
    ]);

    const passwordHash = await hashPassword('OwnerPass123!');
    ownerAUserId = randomUUID();

    await db.insert(schema.users).values({
      id: ownerAUserId,
      shopId: shopAId,
      name: 'Owner POS A',
      email: `pos_owner_${Date.now()}@test.com`,
      passwordHash,
      role: 'ADMIN'
    });

    ownerAToken = `token_pos_${randomUUID()}`;
    const tokenHash = hashToken(ownerAToken);
    await db.insert(schema.sessions).values({
      id: randomUUID(),
      userId: ownerAUserId,
      shopId: shopAId,
      tokenHash,
      expiresAt: new Date(Date.now() + 3600000)
    });
    ownerACookie = `pos_session=${ownerAToken}`;

    // Create Gold Rates for Shop A & B
    await db.insert(schema.goldRates).values([
      { id: randomUUID(), shopId: shopAId, rate24k: '7450.00', rate22k: '6980.00', rate18k: '5720.00', rateSilver: '92.00', createdBy: ownerAUserId },
      { id: randomUUID(), shopId: shopBId, rate24k: '7500.00', rate22k: '7000.00', rate18k: '5800.00', rateSilver: '95.00', createdBy: ownerAUserId }
    ]);

    // Create Test Items for Shop A
    inStockItemId = randomUUID();
    soldItemId = randomUUID();
    incompleteItemId = randomUUID();
    shopBItemId = randomUUID();

    await db.insert(schema.jewelleryItems).values([
      {
        id: inStockItemId,
        shopId: shopAId,
        itemCode: 'RN-10245',
        category: 'Rings',
        designTitle: '22K Gold Diamond Cut Ring',
        metal: 'GOLD',
        purity: '22K 916',
        grossWeight: '5.820',
        stoneWeight: '0.410',
        netWeight: '5.410',
        huid: 'RN9988',
        makingChargeType: 'FLAT',
        makingChargeValue: '1200.00',
        wastagePct: '1.50',
        stoneValue: '450.00',
        status: 'IN_STOCK'
      },
      {
        id: soldItemId,
        shopId: shopAId,
        itemCode: 'RN-SOLD-001',
        category: 'Rings',
        designTitle: 'Already Sold Ring',
        metal: 'GOLD',
        purity: '22K 916',
        grossWeight: '4.000',
        stoneWeight: '0.000',
        netWeight: '4.000',
        status: 'SOLD'
      },
      {
        id: incompleteItemId,
        shopId: shopAId,
        itemCode: 'RN-INCOMP-001',
        category: 'Rings',
        designTitle: 'Incomplete Pricing Ring',
        metal: 'GOLD',
        purity: '22K 916',
        grossWeight: '0.000',
        stoneWeight: '0.000',
        netWeight: '0.000',
        status: 'IN_STOCK'
      },
      {
        id: shopBItemId,
        shopId: shopBId,
        itemCode: 'RN-SHOPB-999',
        category: 'Rings',
        designTitle: 'Shop B Exclusive Ring',
        metal: 'GOLD',
        purity: '22K 916',
        grossWeight: '6.000',
        stoneWeight: '0.000',
        netWeight: '6.000',
        status: 'IN_STOCK'
      }
    ]);
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  it('TEST 1: In-stock items query returns clean catalog response', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/items?status=IN_STOCK',
      headers: { cookie: ownerACookie }
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.some((i: any) => i.itemCode === 'RN-10245')).toBe(true);
  });

  it('TEST 2 & 3: Manual valid Item Code resolution resolves quote correctly', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/scan/lookup?code=RN-10245',
      headers: { cookie: ownerACookie }
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.item.itemCode).toBe('RN-10245');
    expect(body.data.item.designTitle).toBe('22K Gold Diamond Cut Ring');
    expect(body.data.breakdown.baseMetalValue).toBeDefined();
    expect(body.data.breakdown.makingCharges).toBe('1200.00');
    expect(body.data.breakdown.taxAmount).toBeDefined();
    expect(body.data.breakdown.totalAmount).toBeDefined();
  });

  it('TEST 4: QR code format prefix pos://t/ resolution resolves item cleanly', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/scan/lookup?code=pos://t/RN-10245',
      headers: { cookie: ownerACookie }
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.item.itemCode).toBe('RN-10245');
  });

  it('TEST 5: Invalid Item Code returns friendly error without server crash', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/scan/lookup?code=INVALID-NONEXISTENT-CODE',
      headers: { cookie: ownerACookie }
    });
    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(false);
    expect(body.error.message).toContain('was not found');
  });

  it('TEST 6: Sold item lookup returns explicit sold item error', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/scan/lookup?code=RN-SOLD-001',
      headers: { cookie: ownerACookie }
    });
    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(false);
    expect(body.error.message).toContain('already been sold');
  });

  it('TEST 7: Missing required netWeight pricing data returns explicit incomplete error', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/scan/lookup?code=RN-INCOMP-001',
      headers: { cookie: ownerACookie }
    });
    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(false);
    expect(body.error.message).toContain('Pricing information is incomplete');
  });

  it('TEST 8: Case-insensitive item code search matches lowercase input (rn-10245)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/scan/lookup?code=rn-10245',
      headers: { cookie: ownerACookie }
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.item.itemCode).toBe('RN-10245');
  });

  it('TEST 12: Manual HUID code resolution resolves item correctly (rn9988)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/scan/lookup?code=rn9988',
      headers: { cookie: ownerACookie }
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.item.itemCode).toBe('RN-10245');
  });

  it('TEST 13: Cross-tenant item code lookup hard-fails (Shop A cannot resolve Shop B item)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/scan/lookup?code=RN-SHOPB-999',
      headers: { cookie: ownerACookie }
    });
    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(false);
    expect(body.error.message).toContain('was not found');
  });

  it('TEST 14: Authenticated billing session works normally', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: { cookie: ownerACookie }
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.role).toBe('ADMIN');
  });

  it('TEST 15: Unauthenticated billing request responds with 401 Unauthorized', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/scan/lookup?code=RN-10245'
      // No session cookie
    });
    expect(res.statusCode).toBe(401);
  });
});
