import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../server.js';
import { FastifyInstance } from 'fastify';
import { getDatabase } from '../db/connection.js';
import * as schema from '../db/schema/index.js';
import { hashPassword, hashToken } from '../services/crypto.js';
import { randomUUID } from 'crypto';

describe('AUTHENTICATION & NEW JEWELLERY ITEM CREATION REGRESSION SUITE', () => {
  let app: FastifyInstance;
  let shopAId: string;
  let shopBId: string;
  let ownerAUserId: string;
  let ownerAToken: string;
  let ownerACookie: string;

  beforeAll(async () => {
    app = await buildServer();
    await app.ready();
    const { db } = await getDatabase();

    shopAId = randomUUID();
    shopBId = randomUUID();

    await db.insert(schema.shops).values([
      { id: shopAId, name: 'Auth Test Shop A', code: `AUTHA_${Date.now()}`, address: 'Jewellery Hub A' },
      { id: shopBId, name: 'Auth Test Shop B', code: `AUTHB_${Date.now()}`, address: 'Jewellery Hub B' }
    ]);

    const passwordHash = await hashPassword('OwnerPass123!');
    ownerAUserId = randomUUID();

    await db.insert(schema.users).values({
      id: ownerAUserId,
      shopId: shopAId,
      name: 'Owner Auth A',
      email: `auth_owner_${Date.now()}@test.com`,
      passwordHash,
      role: 'ADMIN'
    });

    ownerAToken = `token_auth_${randomUUID()}`;
    const tokenHash = hashToken(ownerAToken);
    await db.insert(schema.sessions).values({
      id: randomUUID(),
      userId: ownerAUserId,
      shopId: shopAId,
      tokenHash,
      expiresAt: new Date(Date.now() + 3600000)
    });
    ownerACookie = `pos_session=${ownerAToken}`;
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  it('TEST 1: Valid authenticated session → GET /auth/me returns HTTP 200 with user session', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: { cookie: ownerACookie }
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.id).toBe(ownerAUserId);
    expect(body.data.shopId).toBe(shopAId);
    expect(body.data.role).toBe('ADMIN');
  });

  it('TEST 2: No session → GET /auth/me returns HTTP 401 Unauthorized', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me'
    });
    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(false);
  });

  it('TEST 3: Valid authenticated session → GET /items returns HTTP 200 catalog array', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/items',
      headers: { cookie: ownerACookie }
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });

  it('TEST 4: Valid authenticated session → POST /items creates item successfully (HTTP 201)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/items',
      headers: { cookie: ownerACookie },
      payload: {
        itemCode: `KJ-GLD-${Date.now().toString().slice(-4)}`,
        designTitle: '22k ring',
        category: 'Rings',
        metal: 'GOLD',
        purity: '22K',
        grossWeight: '15.500',
        stoneWeight: '0.000',
        huid: 'AH8921',
        hallmarkVerified: true,
        makingChargeType: 'FLAT',
        makingChargeValue: '450.00',
        wastagePct: '1.50',
        stoneValue: '0.00'
      }
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.designTitle).toBe('22k ring');
    expect(body.data.shopId).toBe(shopAId);
    expect(body.data.huid).toBe('AH8921');
  });

  it('TEST 5: No session → POST /items returns HTTP 401 Unauthorized', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/items',
      payload: {
        itemCode: 'UNAUTH-001',
        designTitle: 'Unauthenticated Item',
        category: 'Rings',
        metal: 'GOLD',
        purity: '22K',
        grossWeight: '10.000'
      }
    });
    expect(res.statusCode).toBe(401);
  });

  it('TEST 6: Invalid/fake session → POST /items returns HTTP 401 Unauthorized', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/items',
      headers: { cookie: 'pos_session=fake_invalid_token_999' },
      payload: {
        itemCode: 'INVALID-SESS-001',
        designTitle: 'Invalid Session Item',
        category: 'Rings',
        metal: 'GOLD',
        purity: '22K',
        grossWeight: '10.000'
      }
    });
    expect(res.statusCode).toBe(401);
  });

  it('TEST 7: Authenticated Shop A cannot create item under Shop B (shopId derived from user session)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/items',
      headers: { cookie: ownerACookie },
      payload: {
        itemCode: 'CROSS-SHOP-001',
        designTitle: 'Tampered Shop Item',
        category: 'Rings',
        metal: 'GOLD',
        purity: '22K',
        grossWeight: '12.000',
        makingChargeValue: '450.00',
        shopId: shopBId // Attempt to inject Shop B ID
      }
    });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    // Verified shopId is forced to shopAId from session!
    expect(body.data.shopId).toBe(shopAId);
  });

  it('TEST 8: Authenticated Shop A user cannot access Shop B inventory item', async () => {
    const { db } = await getDatabase();
    const shopBItem = randomUUID();

    await db.insert(schema.jewelleryItems).values({
      id: shopBItem,
      shopId: shopBId,
      itemCode: 'SHOPB-ITEM-101',
      category: 'Bangles',
      designTitle: 'Shop B Exclusive Bangle',
      metal: 'GOLD',
      purity: '22K 916',
      grossWeight: '20.000',
      stoneWeight: '0.000',
      netWeight: '20.000',
      status: 'IN_STOCK'
    });

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/items/${shopBItem}`,
      headers: { cookie: ownerACookie }
    });
    expect(res.statusCode).toBe(404);
  });

  it('TEST 9: Session cookie pos_session is correctly parsed for authenticated requests', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: { cookie: ownerACookie }
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.email).toContain('auth_owner_');
  });

  it('TEST 10: Revoked session causes HTTP 401 Unauthorized', async () => {
    const { db } = await getDatabase();
    const revokedToken = `token_revoked_${randomUUID()}`;
    const tokenHash = hashToken(revokedToken);

    await db.insert(schema.sessions).values({
      id: randomUUID(),
      userId: ownerAUserId,
      shopId: shopAId,
      tokenHash,
      expiresAt: new Date(Date.now() + 3600000),
      revoked: true
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: { cookie: `pos_session=${revokedToken}` }
    });
    expect(res.statusCode).toBe(401);
  });
});
