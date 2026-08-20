import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../server.js';
import { FastifyInstance } from 'fastify';
import { getDatabase } from '../db/connection.js';
import * as schema from '../db/schema/index.js';
import { hashPassword, hashToken } from '../services/crypto.js';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';

describe('OWNER SECURITY, 6-DIGIT PIN, BILL DESIGNER & RBAC ENFORCEMENT', () => {
  let app: FastifyInstance;
  let shopAId: string;
  let shopBId: string;
  let ownerAToken: string;
  let ownerACookie: string;
  let cashierAToken: string;
  let cashierACookie: string;
  let ownerBToken: string;
  let ownerBCookie: string;
  let ownerAUserId: string;

  beforeAll(async () => {
    app = await buildServer();
    await app.ready();
    const { db } = await getDatabase();

    shopAId = randomUUID();
    shopBId = randomUUID();

    // Create Shop A and Shop B
    await db.insert(schema.shops).values([
      { id: shopAId, name: 'Owner Shop A Jewellers', code: `OSPA_${Date.now()}`, address: 'Jewellery Hub A' },
      { id: shopBId, name: 'Owner Shop B Jewellers', code: `OSPB_${Date.now()}`, address: 'Jewellery Hub B' }
    ]);

    const passwordHash = await hashPassword('OwnerPass123!');

    ownerAUserId = randomUUID();
    const cashierAUser = randomUUID();
    const ownerBUser = randomUUID();

    await db.insert(schema.users).values([
      { id: ownerAUserId, shopId: shopAId, name: 'Owner A', email: `ownerA_${Date.now()}@test.com`, passwordHash, role: 'ADMIN' },
      { id: cashierAUser, shopId: shopAId, name: 'Cashier A', email: `cashierA_${Date.now()}@test.com`, passwordHash, role: 'CLERK' },
      { id: ownerBUser, shopId: shopBId, name: 'Owner B', email: `ownerB_${Date.now()}@test.com`, passwordHash, role: 'ADMIN' }
    ]);

    ownerAToken = `token_ownerA_${randomUUID()}`;
    cashierAToken = `token_cashierA_${randomUUID()}`;
    ownerBToken = `token_ownerB_${randomUUID()}`;

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await db.insert(schema.sessions).values([
      { userId: ownerAUserId, shopId: shopAId, tokenHash: hashToken(ownerAToken), expiresAt },
      { userId: cashierAUser, shopId: shopAId, tokenHash: hashToken(cashierAToken), expiresAt },
      { userId: ownerBUser, shopId: shopBId, tokenHash: hashToken(ownerBToken), expiresAt }
    ]);

    ownerACookie = `pos_session=${ownerAToken}`;
    cashierACookie = `pos_session=${cashierAToken}`;
    ownerBCookie = `pos_session=${ownerBToken}`;
  }, 30000);

  afterAll(async () => {
    if (app) await app.close();
  });

  it('1. Owner PIN setup requires exactly 6 numeric digits', async () => {
    // 5 digits -> 400 Bad Request
    const resInvalid = await app.inject({
      method: 'POST',
      url: '/api/v1/settings/owner-pin/setup',
      headers: { cookie: ownerACookie },
      payload: { pin: '12345' }
    });
    expect(resInvalid.statusCode).toBe(400);

    // 6 digits -> 200 Success
    const resValid = await app.inject({
      method: 'POST',
      url: '/api/v1/settings/owner-pin/setup',
      headers: { cookie: ownerACookie },
      payload: { pin: '123456' }
    });
    expect(resValid.statusCode).toBe(200);
    const json = JSON.parse(resValid.payload);
    expect(json.success).toBe(true);
  });

  it('2. Owner PIN verification accepts correct PIN and rejects incorrect PIN', async () => {
    // Wrong PIN
    const resWrong = await app.inject({
      method: 'POST',
      url: '/api/v1/settings/owner-pin/verify',
      headers: { cookie: ownerACookie },
      payload: { pin: '999999' }
    });
    expect(resWrong.statusCode).toBe(401);

    // Correct PIN
    const resCorrect = await app.inject({
      method: 'POST',
      url: '/api/v1/settings/owner-pin/verify',
      headers: { cookie: ownerACookie },
      payload: { pin: '123456' }
    });
    expect(resCorrect.statusCode).toBe(200);
    const json = JSON.parse(resCorrect.payload);
    expect(json.data.verified).toBe(true);
  });

  it('3. Non-Owner (CLERK/Cashier) receives HTTP 403 Forbidden on Owner-only endpoints', async () => {
    // 1. PIN setup
    const r1 = await app.inject({
      method: 'POST',
      url: '/api/v1/settings/owner-pin/setup',
      headers: { cookie: cashierACookie },
      payload: { pin: '654321' }
    });
    expect(r1.statusCode).toBe(403);

    // 2. Invoice template update
    const r2 = await app.inject({
      method: 'PUT',
      url: '/api/v1/settings/invoice-template',
      headers: { cookie: cashierACookie },
      payload: { paperSize: '80mm', logoVisible: false }
    });
    expect(r2.statusCode).toBe(403);

    // 3. Post Rates
    const r3 = await app.inject({
      method: 'POST',
      url: '/api/v1/rates',
      headers: { cookie: cashierACookie },
      payload: { rate24k: 7500, rate22k: 7000, rate18k: 5800, rateSilver: 85 }
    });
    expect(r3.statusCode).toBe(403);
  });

  it('4. Owner can customize and persist Bill & Receipt Invoice Template', async () => {
    const templatePayload = {
      paperSize: '80mm',
      logoVisible: true,
      shopNameVisible: true,
      addressVisible: true,
      gstinVisible: true,
      phoneVisible: true,
      emailVisible: true,
      customerNameVisible: true,
      customerMobileVisible: true,
      customerAddressVisible: false,
      customerPanVisible: true,
      customerGstinVisible: false,
      itemHuidVisible: true,
      itemBarcodeVisible: true,
      itemGrossWeightVisible: true,
      itemStoneWeightVisible: false,
      itemNetWeightVisible: true,
      itemMakingChargesVisible: true,
      itemWastageVisible: false,
      itemStoneValueVisible: false,
      itemDiscountVisible: true,
      cgstSgstBreakdownVisible: true,
      oldGoldDeductionVisible: true,
      termsVisible: true,
      termsText: 'No returns without valid GST bill.',
      footerText: 'Visit Again — Kamal Jewellers'
    };

    const res = await app.inject({
      method: 'PUT',
      url: '/api/v1/settings/invoice-template',
      headers: { cookie: ownerACookie },
      payload: templatePayload
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.payload);
    expect(json.data.paperSize).toBe('80mm');
    expect(json.data.termsText).toBe('No returns without valid GST bill.');
  });

  it('5. Tenant Isolation: Shop A Owner changes do not leak or affect Shop B', async () => {
    const resB = await app.inject({
      method: 'GET',
      url: '/api/v1/settings/invoice-template',
      headers: { cookie: ownerBCookie }
    });

    expect(resB.statusCode).toBe(200);
    const jsonB = JSON.parse(resB.payload);
    expect(jsonB.data.paperSize).toBe('A4'); // Shop B remains default A4
  });

  it('6. Audit logs record OWNER_PIN_SET, OWNER_MODE_AUTHENTICATED, and BILL_TEMPLATE_UPDATED with ZERO secret exposure', async () => {
    const { db } = await getDatabase();
    const logs = await db.select().from(schema.auditLogs).where(eq(schema.auditLogs.shopId, shopAId));

    expect(logs.length).toBeGreaterThan(0);
    const actions = logs.map((l: any) => l.action);
    expect(actions).toContain('OWNER_PIN_SET');
    expect(actions).toContain('OWNER_MODE_AUTHENTICATED');
    expect(actions).toContain('BILL_TEMPLATE_UPDATED');

    // Confirm no plaintext PIN or password appears in audit log stateDiff
    logs.forEach((log: any) => {
      const str = JSON.stringify(log.stateDiff || {});
      expect(str).not.toContain('123456');
      expect(str).not.toContain('OwnerPass123!');
    });
  });

  it('7. GET /settings excludes plaintext ownerPinHash and exposes ownerPinSet boolean', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/settings',
      headers: { cookie: ownerACookie }
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.payload);
    expect(json.data.ownerPinHash).toBeUndefined();
    expect(json.data.ownerPinSet).toBe(true);
  });
});
