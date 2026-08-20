import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { buildServer } from '../server.js';
import { FastifyInstance } from 'fastify';
import { getDatabase } from '../db/connection.js';
import * as schema from '../db/schema/index.js';
import { hashPassword, hashPin } from '../services/crypto.js';
import { resetRateLimits } from '../middleware/rateLimit.js';
import { randomUUID } from 'crypto';

describe('LOGIN CREDENTIAL & PIN SECURITY REGRESSION SUITE (TESTS 1 - 18)', () => {
  let app: FastifyInstance;
  let shopId: string;
  let ownerUserId: string;
  let cashierUserId: string;

  beforeEach(() => {
    resetRateLimits();
  });

  const validOwnerPin = String(Math.floor(1000 + Math.random() * 4000));
  const validCashierPin = String(Math.floor(5000 + Math.random() * 4000));
  const wrongPin = '9999';

  afterAll(async () => {
    if (app) await app.close();
  });

  beforeAll(async () => {
    app = await buildServer();
    await app.ready();
    const { db } = await getDatabase();

    shopId = randomUUID();

    await db.insert(schema.shops).values({
      id: shopId,
      name: 'PIN Security Test Showroom',
      code: `SEC_${Date.now()}`,
      address: 'Zaveri Bazaar, Mumbai'
    });

    const ownerPassHash = await hashPassword('OwnerPass123!');
    const ownerPinHash = await hashPin(validOwnerPin);
    ownerUserId = randomUUID();

    await db.insert(schema.users).values({
      id: ownerUserId,
      shopId,
      name: 'Owner User',
      email: `owner_sec_${Date.now()}@test.com`,
      passwordHash: ownerPassHash,
      pinHash: ownerPinHash,
      role: 'ADMIN',
      isActive: true
    });

    const cashierPassHash = await hashPassword('CashierPass123!');
    const cashierPinHash = await hashPin(validCashierPin);
    cashierUserId = randomUUID();

    await db.insert(schema.users).values({
      id: cashierUserId,
      shopId,
      name: 'Cashier User',
      email: `cashier_sec_${Date.now()}@test.com`,
      passwordHash: cashierPassHash,
      pinHash: cashierPinHash,
      role: 'CLERK',
      isActive: true
    });
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  it('TEST 1: Correct Owner PIN → authentication succeeds (HTTP 200 + cookie)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/pin-login',
      payload: { pin: validOwnerPin }
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.session.role).toBe('ADMIN');
    expect(res.headers['set-cookie']).toBeDefined();
  });

  it('TEST 2: Wrong Owner PIN → HTTP 401 Unauthorized & NO session created', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/pin-login',
      payload: { pin: wrongPin }
    });

    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('UNAUTHORIZED_PIN');
  });

  it('TEST 3: Correct Cashier PIN → authentication succeeds (HTTP 200 + CLERK role)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/pin-login',
      payload: { pin: validCashierPin }
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.session.role).toBe('CLERK');
  });

  it('TEST 4: Wrong Cashier PIN → HTTP 401 Unauthorized', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/pin-login',
      payload: { pin: '1111' }
    });

    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(false);
  });

  it('TEST 5: Random 4-digit PIN → HTTP 401 Unauthorized', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/pin-login',
      payload: { pin: '0000' }
    });

    expect(res.statusCode).toBe(401);
  });

  it('TEST 6: Empty PIN → HTTP 400 Bad Request', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/pin-login',
      payload: { pin: '' }
    });

    expect(res.statusCode).toBe(400);
  });

  it('TEST 7: 3-digit PIN → HTTP 400 Bad Request', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/pin-login',
      payload: { pin: '123' }
    });

    expect(res.statusCode).toBe(400);
  });

  it('TEST 8: 5-digit PIN → HTTP 400 Bad Request', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/pin-login',
      payload: { pin: '12345' }
    });

    expect(res.statusCode).toBe(400);
  });

  it('TEST 9: Wrong PIN cannot access /auth/me', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: { cookie: 'pos_session=invalid_wrong_pin_token_123' }
    });

    expect(res.statusCode).toBe(401);
  });

  it('TEST 10: Wrong PIN cannot access /api/v1/items', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/items',
      headers: { cookie: 'pos_session=invalid_wrong_pin_token_123' }
    });

    expect(res.statusCode).toBe(401);
  });

  it('TEST 11: Wrong PIN cannot create /api/v1/items', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/items',
      headers: { cookie: 'pos_session=invalid_wrong_pin_token_123' },
      payload: {
        itemCode: 'UNAUTH-ITEM-001',
        designTitle: 'Hacker Gold Ring',
        category: 'Rings',
        metal: 'GOLD',
        purity: '22K',
        grossWeight: '10.000',
        makingChargeValue: '250.00'
      }
    });

    expect(res.statusCode).toBe(401);
  });

  it('TEST 12: Correct authenticated user can access /api/v1/items', async () => {
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/pin-login',
      payload: { pin: validOwnerPin }
    });
    const cookie = loginRes.headers['set-cookie'] as string;

    const itemsRes = await app.inject({
      method: 'GET',
      url: '/api/v1/items',
      headers: { cookie }
    });

    expect(itemsRes.statusCode).toBe(200);
    const body = JSON.parse(itemsRes.body);
    expect(body.success).toBe(true);
  });

  it('TEST 13: Correct authenticated user can create item', async () => {
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/pin-login',
      payload: { pin: validOwnerPin }
    });
    const cookie = loginRes.headers['set-cookie'] as string;

    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/items',
      headers: { cookie },
      payload: {
        itemCode: `SEC-ITEM-${Date.now().toString().slice(-4)}`,
        designTitle: 'Security Verified Ring',
        category: 'Rings',
        metal: 'GOLD',
        purity: '22K',
        grossWeight: '14.200',
        stoneWeight: '0.000',
        makingChargeValue: '400.00'
      }
    });

    expect(createRes.statusCode).toBe(201);
    const body = JSON.parse(createRes.body);
    expect(body.success).toBe(true);
    expect(body.data.shopId).toBe(shopId);
  });

  it('TEST 14: Owner role cannot be forged from frontend input', async () => {
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/pin-login',
      payload: { pin: validCashierPin, role: 'ADMIN' } as any
    });

    expect(loginRes.statusCode).toBe(200);
    const body = JSON.parse(loginRes.body);
    // Role MUST remain CLERK as retrieved from database for cashier user!
    expect(body.data.session.role).toBe('CLERK');
  });

  it('TEST 15: Cashier cannot escalate to Owner', async () => {
    const cashierLogin = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/pin-login',
      payload: { pin: validCashierPin }
    });
    const cookie = cashierLogin.headers['set-cookie'] as string;

    // Cashier attempts to access owner-only admin endpoint (backup/export)
    const ownerOnlyRes = await app.inject({
      method: 'POST',
      url: '/api/v1/backup/export',
      headers: { cookie }
    });

    expect(ownerOnlyRes.statusCode).toBe(403); // Forbidden for non-ADMIN (CLERK)
  });

  it('TEST 16: Existing valid session remains valid according to session lifecycle', async () => {
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/pin-login',
      payload: { pin: validOwnerPin }
    });
    const cookie = loginRes.headers['set-cookie'] as string;

    const meRes = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: { cookie }
    });

    expect(meRes.statusCode).toBe(200);
  });

  it('TEST 17: Invalid/expired session returns 401', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: { cookie: 'pos_session=expired_session_token_xyz' }
    });

    expect(res.statusCode).toBe(401);
  });

  it('TEST 18: Failed login does not create pos_session cookie or active session', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/pin-login',
      payload: { pin: wrongPin }
    });

    expect(res.statusCode).toBe(401);
    expect(res.headers['set-cookie']).toBeUndefined();
  });
});
