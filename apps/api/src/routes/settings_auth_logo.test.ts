import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../server.js';
import { FastifyInstance } from 'fastify';
import { getDatabase } from '../db/connection.js';
import * as schema from '../db/schema/index.js';
import { hashPassword, hashToken } from '../services/crypto.js';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';

describe('SHOWROOM PROFILE & LOGO BACKEND SECURITY & TENANT ISOLATION', () => {
  let app: FastifyInstance;
  let shopAId: string;
  let shopBId: string;
  let adminAToken: string;
  let adminACookie: string;
  let cashierAToken: string;
  let cashierACookie: string;
  let adminBToken: string;
  let adminBCookie: string;

  beforeAll(async () => {
    app = await buildServer();
    await app.ready();
    const { db } = await getDatabase();

    shopAId = randomUUID();
    shopBId = randomUUID();

    // Create Shop A and Shop B
    await db.insert(schema.shops).values([
      { id: shopAId, name: 'Shop A Jewellers', code: `SPA_${Date.now()}`, address: 'Main Bazaar A' },
      { id: shopBId, name: 'Shop B Jewellers', code: `SPB_${Date.now()}`, address: 'Main Bazaar B' }
    ]);

    const passwordHash = await hashPassword('Admin123!');

    const adminAUser = randomUUID();
    const cashierAUser = randomUUID();
    const adminBUser = randomUUID();

    await db.insert(schema.users).values([
      { id: adminAUser, shopId: shopAId, name: 'Admin A', email: `adminA_${Date.now()}@test.com`, passwordHash, role: 'ADMIN' },
      { id: cashierAUser, shopId: shopAId, name: 'Cashier A', email: `cashierA_${Date.now()}@test.com`, passwordHash, role: 'CLERK' },
      { id: adminBUser, shopId: shopBId, name: 'Admin B', email: `adminB_${Date.now()}@test.com`, passwordHash, role: 'ADMIN' }
    ]);

    // Sessions
    adminAToken = `token_adminA_${randomUUID()}`;
    cashierAToken = `token_cashierA_${randomUUID()}`;
    adminBToken = `token_adminB_${randomUUID()}`;

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await db.insert(schema.sessions).values([
      { userId: adminAUser, shopId: shopAId, tokenHash: hashToken(adminAToken), expiresAt },
      { userId: cashierAUser, shopId: shopAId, tokenHash: hashToken(cashierAToken), expiresAt },
      { userId: adminBUser, shopId: shopBId, tokenHash: hashToken(adminBToken), expiresAt }
    ]);

    adminACookie = `pos_session=${adminAToken}`;
    cashierACookie = `pos_session=${cashierAToken}`;
    adminBCookie = `pos_session=${adminBToken}`;
  }, 30000);

  afterAll(async () => {
    if (app) await app.close();
  });

  it('1. Unauthenticated request to PUT /settings returns HTTP 401', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/v1/settings',
      payload: { name: 'Hacked Shop Name' }
    });

    expect(res.statusCode).toBe(401);
  });

  it('2. Cashier role attempting PUT /settings returns HTTP 403 Forbidden', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/v1/settings',
      headers: { cookie: cashierACookie },
      payload: { name: 'Unauthorized Cashier Change' }
    });

    expect(res.statusCode).toBe(403);
  });

  it('3. Authenticated Admin updating showroom profile returns HTTP 200 & updates DB', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/v1/settings',
      headers: { cookie: adminACookie },
      payload: { name: 'Updated Shop A Name', gstin: '07AAAAA0000A1Z5' }
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.payload);
    expect(json.success).toBe(true);
    expect(json.data.name).toBe('Updated Shop A Name');

    const { db } = await getDatabase();
    const rows = await db.select().from(schema.shops).where(eq(schema.shops.id, shopAId));
    expect(rows[0].name).toBe('Updated Shop A Name');
  });

  it('4. Rejects logo upload with invalid format (e.g. non-image data)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/settings/logo',
      headers: { cookie: adminACookie },
      payload: { imageBase64: 'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==' }
    });

    expect(res.statusCode).toBe(400);
    const json = JSON.parse(res.payload);
    expect(json.error.code).toBe('INVALID_FORMAT');
  });

  it('5. Successfully uploads PNG logo, updates logo_url, and creates audit log', async () => {
    // 1x1 transparent PNG base64
    const validPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/settings/logo',
      headers: { cookie: adminACookie },
      payload: { imageBase64: validPng }
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.payload);
    expect(json.success).toBe(true);
    expect(json.data.logoUrl).toContain(`/api/v1/uploads/logos/logo_${shopAId}_`);

    const { db } = await getDatabase();
    const auditRows = await db
      .select()
      .from(schema.auditLogs)
      .where(eq(schema.auditLogs.shopId, shopAId));

    const logoAudit = auditRows.find((a: any) => a.action === 'SHOP_LOGO_UPLOADED' || a.action === 'SHOP_LOGO_CHANGED');
    expect(logoAudit).toBeDefined();
  });

  it('6. Tenant Isolation: Shop A Admin cannot access or modify Shop B profile/logo', async () => {
    // Admin A sends request under Shop A session context
    // When Admin A updates settings, it MUST only affect Shop A, leaving Shop B completely untouched!
    const { db } = await getDatabase();
    const shopBOriginal = (await db.select().from(schema.shops).where(eq(schema.shops.id, shopBId)))[0];

    const res = await app.inject({
      method: 'PUT',
      url: '/api/v1/settings',
      headers: { cookie: adminACookie },
      payload: { name: 'Attempted Shop A Tamper' }
    });

    expect(res.statusCode).toBe(200);

    // Verify Shop B remains unaltered
    const shopBAfter = (await db.select().from(schema.shops).where(eq(schema.shops.id, shopBId)))[0];
    expect(shopBAfter.name).toBe(shopBOriginal.name);
    expect(shopBAfter.name).not.toBe('Attempted Shop A Tamper');

    // Admin B updates Shop B independently
    const resB = await app.inject({
      method: 'PUT',
      url: '/api/v1/settings',
      headers: { cookie: adminBCookie },
      payload: { name: 'Shop B Independent Name' }
    });
    expect(resB.statusCode).toBe(200);
  });

  it('7. Removes logo, clears logo_url to NULL, and logs SHOP_LOGO_REMOVED audit event', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/v1/settings/logo',
      headers: { cookie: adminACookie }
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.payload);
    expect(json.data.logoUrl).toBeNull();

    const { db } = await getDatabase();
    const shopRow = (await db.select().from(schema.shops).where(eq(schema.shops.id, shopAId)))[0];
    expect(shopRow.logoUrl).toBeNull();

    const auditRows = await db.select().from(schema.auditLogs).where(eq(schema.auditLogs.shopId, shopAId));
    const removeAudit = auditRows.find((a: any) => a.action === 'SHOP_LOGO_REMOVED');
    expect(removeAudit).toBeDefined();
  });

  it('8. Cross-tenant authorization check: Shop A cannot modify Shop B profile/logo through API', async () => {
    const { db } = await getDatabase();
    const shopBOriginal = (await db.select().from(schema.shops).where(eq(schema.shops.id, shopBId)))[0];

    // Authenticate as Shop A and attempt to modify Shop B's profile
    const res = await app.inject({
      method: 'PUT',
      url: '/api/v1/settings',
      headers: { cookie: adminACookie },
      payload: { shopId: shopBId, id: shopBId, name: 'Cross Tenant Malicious Name' }
    });

    // Session scoping enforces updates to authenticated Shop A only or returns denied
    expect([200, 403]).toContain(res.statusCode);

    // Assert Shop B remains 100% unchanged in PostgreSQL
    const shopBAfter = (await db.select().from(schema.shops).where(eq(schema.shops.id, shopBId)))[0];
    expect(shopBAfter.name).toBe(shopBOriginal.name);
    expect(shopBAfter.name).not.toBe('Cross Tenant Malicious Name');
  });

  it('9. Persistence after backend restart/reinitialization: Saved profile and logo survive restart', async () => {
    const validPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

    // 1. Save profile and upload logo
    const updateRes = await app.inject({
      method: 'PUT',
      url: '/api/v1/settings',
      headers: { cookie: adminACookie },
      payload: { name: 'Persistent Showroom Name' }
    });
    expect(updateRes.statusCode).toBe(200);

    const logoRes = await app.inject({
      method: 'POST',
      url: '/api/v1/settings/logo',
      headers: { cookie: adminACookie },
      payload: { imageBase64: validPng }
    });
    expect(logoRes.statusCode).toBe(200);
    const savedLogoUrl = JSON.parse(logoRes.payload).data.logoUrl;

    // 2. Fully reinitialize/restart the API application context
    await app.close();
    const restartedApp = await buildServer();
    await restartedApp.ready();

    // 3. Read the shop directly from database in restarted context
    const { db } = await getDatabase();
    const shopRow = (await db.select().from(schema.shops).where(eq(schema.shops.id, shopAId)))[0];

    expect(shopRow).toBeDefined();
    expect(shopRow.name).toBe('Persistent Showroom Name');
    expect(shopRow.logoUrl).toBe(savedLogoUrl);

    await restartedApp.close();
    app = await buildServer();
    await app.ready();
  });
});
