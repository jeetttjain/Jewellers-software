import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { buildServer } from '../server.js';
import { FastifyInstance } from 'fastify';
import { getDatabase } from '../db/connection.js';
import * as schema from '../db/schema/index.js';
import { eq } from 'drizzle-orm';
import { hashPassword, hashPin } from '../services/crypto.js';
import { resetRateLimits } from '../middleware/rateLimit.js';
import { BackupService } from '../services/backup.service.js';
import { randomUUID } from 'crypto';

describe('PRODUCTION DEFENSIVE SECURITY & OWASP HARDENING TEST SUITE', () => {
  let app: FastifyInstance;
  let shopAId: string;
  let shopBId: string;
  let ownerAUserId: string;
  let cashierAUserId: string;
  let ownerBUserId: string;

  let ownerASessionCookie: string;
  let cashierASessionCookie: string;

  const validOwnerPin = '123456';

  beforeAll(async () => {
    app = await buildServer();
    await app.ready();
    const { db } = await getDatabase();

    // 1. Create Shop A
    shopAId = randomUUID();
    const now = Date.now();
    await db.insert(schema.shops).values({
      id: shopAId,
      name: 'Shop A Security Showroom',
      code: `SHPA_${now}`,
      address: 'Zaveri Bazaar, Mumbai',
      defaultTaxPercent: '3.00',
      invoicePrefix: 'KA'
    });

    const ownerAPass = await hashPassword('OwnerAPass123!');
    const ownerAPin = await hashPin(validOwnerPin);
    ownerAUserId = randomUUID();
    const ownerAEmail = `ownera_${now}@security.test`;
    await db.insert(schema.users).values({
      id: ownerAUserId,
      shopId: shopAId,
      name: 'Owner A',
      email: ownerAEmail,
      passwordHash: ownerAPass,
      pinHash: ownerAPin,
      role: 'ADMIN',
      isActive: true
    });

    // Set Owner PIN on Shop A
    await db.update(schema.shops).set({ ownerPinHash: ownerAPin }).where(eq(schema.shops.id, shopAId));

    const cashierAPass = await hashPassword('CashierAPass123!');
    const cashierAPin = await hashPin('4321');
    cashierAUserId = randomUUID();
    const cashierAEmail = `cashiera_${now}@security.test`;
    await db.insert(schema.users).values({
      id: cashierAUserId,
      shopId: shopAId,
      name: 'Cashier A',
      email: cashierAEmail,
      passwordHash: cashierAPass,
      pinHash: cashierAPin,
      role: 'CLERK',
      isActive: true
    });

    // 2. Create Shop B (Distinct Tenant)
    shopBId = randomUUID();
    await db.insert(schema.shops).values({
      id: shopBId,
      name: 'Shop B Isolated Showroom',
      code: `SHPB_${now}`,
      address: 'Karol Bagh, Delhi',
      defaultTaxPercent: '3.00',
      invoicePrefix: 'KB'
    });

    const ownerBPass = await hashPassword('OwnerBPass123!');
    ownerBUserId = randomUUID();
    const ownerBEmail = `ownerb_${now}@security.test`;
    await db.insert(schema.users).values({
      id: ownerBUserId,
      shopId: shopBId,
      name: 'Owner B',
      email: ownerBEmail,
      passwordHash: ownerBPass,
      role: 'ADMIN',
      isActive: true
    });

    // Obtain Session Cookies via Login
    const loginResA = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: ownerAEmail, password: 'OwnerAPass123!' }
    });
    ownerASessionCookie = loginResA.headers['set-cookie'] as string;

    const loginResCashier = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: cashierAEmail, password: 'CashierAPass123!' }
    });
    cashierASessionCookie = loginResCashier.headers['set-cookie'] as string;
  }, 60000);

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    resetRateLimits();
  });

  // =========================================================================
  // SECTION 1: BROKEN ACCESS CONTROL & UNATHENTICATED ACCESS REJECTION
  // =========================================================================
  describe('1. OWASP A01: Broken Access Control & Unauthenticated Rejection', () => {
    it('TEST 1.1: Unauthenticated GET /invoices returns 401 Unauthorized', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/v1/invoices' });
      expect(res.statusCode).toBe(401);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(false);
      expect(body.code).toBe('UNAUTHORIZED');
    });

    it('TEST 1.2: Unauthenticated GET /customers returns 401 Unauthorized', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/v1/customers' });
      expect(res.statusCode).toBe(401);
    });

    it('TEST 1.3: Unauthenticated GET /returns returns 401 Unauthorized', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/v1/returns' });
      expect(res.statusCode).toBe(401);
    });

    it('TEST 1.4: Unauthenticated GET /old-gold returns 401 Unauthorized', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/v1/old-gold' });
      expect(res.statusCode).toBe(401);
    });

    it('TEST 1.5: Unauthenticated GET /payments returns 401 Unauthorized', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/v1/payments' });
      expect(res.statusCode).toBe(401);
    });

    it('TEST 1.6: Unauthenticated GET /audit returns 401 Unauthorized', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/v1/audit' });
      expect(res.statusCode).toBe(401);
    });

    it('TEST 1.7: Unauthenticated GET /dashboard returns 401 Unauthorized', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/v1/dashboard' });
      expect(res.statusCode).toBe(401);
    });

    it('TEST 1.8: Unauthenticated GET /settings returns 401 Unauthorized', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/v1/settings' });
      expect(res.statusCode).toBe(401);
    });

    it('TEST 1.9: Unauthenticated GET /labels/template returns 401 Unauthorized', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/v1/labels/template' });
      expect(res.statusCode).toBe(401);
    });

    it('TEST 1.10: Unauthenticated GET /rates/definitions returns 401 Unauthorized', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/v1/rates/definitions' });
      expect(res.statusCode).toBe(401);
    });
  });

  // =========================================================================
  // SECTION 2: MULTI-TENANT ISOLATION & BOLA ATTACK RESISTANCE
  // =========================================================================
  describe('2. Multi-Tenant Isolation & BOLA Attack Defense', () => {
    it('TEST 2.1: Shop A user cannot read Shop B item by ID', async () => {
      const { db } = await getDatabase();
      const shopBItemId = randomUUID();
      await db.insert(schema.jewelleryItems).values({
        id: shopBItemId,
        shopId: shopBId,
        itemCode: `B_ITEM_${Date.now()}`,
        category: 'RINGS',
        designTitle: 'Shop B Secret Diamond Ring',
        metal: 'GOLD',
        purity: '22K',
        grossWeight: '8.500',
        netWeight: '8.500',
        status: 'IN_STOCK'
      });

      // Shop A user attempts to fetch Shop B item
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/items/${shopBItemId}`,
        headers: { cookie: ownerASessionCookie }
      });

      expect(res.statusCode).toBe(404);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(false);
    });

    it('TEST 2.2: Shop A user cannot read Shop B customer details', async () => {
      const { db } = await getDatabase();
      const shopBCustomerId = randomUUID();
      await db.insert(schema.customers).values({
        id: shopBCustomerId,
        shopId: shopBId,
        name: 'Shop B VIP Client',
        mobile: `9988776655`,
        pan: 'ABCDE1234F'
      });

      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/customers/${shopBCustomerId}`,
        headers: { cookie: ownerASessionCookie }
      });

      expect(res.statusCode).toBe(404);
    });

    it('TEST 2.3: Shop A user cannot restore a backup generated by Shop B (Cross-Tenant Restore Protection)', async () => {
      // Create backup file belonging to Shop B
      const { backupBuffer } = await BackupService.createBackup(shopBId, 'FULL', 'JEWELLERY_POS_SECURE_BACKUP_KEY_2026');

      // Shop A Owner attempts to inspect / restore Shop B backup file
      const inspectRes = await app.inject({
        method: 'POST',
        url: '/api/v1/backup/inspect',
        headers: { cookie: ownerASessionCookie },
        payload: { fileBase64: backupBuffer.toString('base64') }
      });

      expect(inspectRes.statusCode).toBe(400);
      const inspectBody = JSON.parse(inspectRes.body);
      expect(inspectBody.error.message).toContain('another shop');

      const restoreRes = await app.inject({
        method: 'POST',
        url: '/api/v1/backup/restore',
        headers: { cookie: ownerASessionCookie },
        payload: { fileBase64: backupBuffer.toString('base64'), pin: validOwnerPin }
      });

      expect(restoreRes.statusCode).toBe(500);
      const restoreBody = JSON.parse(restoreRes.body);
      expect(restoreBody.error.message).toContain('another shop');
    });
  });

  // =========================================================================
  // SECTION 3: ROLE-BASED ACCESS CONTROL (RBAC) SERVER-SIDE ENFORCEMENT
  // =========================================================================
  describe('3. Server-Side RBAC Enforcement', () => {
    it('TEST 3.1: Cashier (CLERK) is forbidden from viewing Audit Logs (403)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/audit',
        headers: { cookie: cashierASessionCookie }
      });
      expect(res.statusCode).toBe(403);
      const body = JSON.parse(res.body);
      expect(body.code).toBe('FORBIDDEN');
    });

    it('TEST 3.2: Cashier (CLERK) is forbidden from creating/modifying Rate Master Definitions (403)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/rates/definitions',
        headers: { cookie: cashierASessionCookie },
        payload: {
          metal: 'GOLD',
          purity: '22K',
          fineness: 916,
          currentRate: 7500,
          isActive: true
        }
      });
      expect(res.statusCode).toBe(403);
    });

    it('TEST 3.3: Cashier (CLERK) is forbidden from modifying Showroom Settings (403)', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/api/v1/settings',
        headers: { cookie: cashierASessionCookie },
        payload: { name: 'Hacked Showroom Name' }
      });
      expect(res.statusCode).toBe(403);
    });

    it('TEST 3.4: Cashier (CLERK) is forbidden from exporting Backups (403)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/backup/export',
        headers: { cookie: cashierASessionCookie },
        payload: { backupType: 'FULL' }
      });
      expect(res.statusCode).toBe(403);
    });
  });

  // =========================================================================
  // SECTION 4: RATE LIMITING & BRUTE FORCE DEFENSE
  // =========================================================================
  describe('4. Rate Limiting & Brute Force Lockout', () => {
    it('TEST 4.1: Repeated failed PIN attempts trigger HTTP 429 Lockout', async () => {
      // Send 6 invalid PIN attempts rapidly
      let lastRes;
      for (let i = 0; i < 6; i++) {
        lastRes = await app.inject({
          method: 'POST',
          url: '/api/v1/auth/pin-login',
          payload: { pin: '0000' }
        });
      }

      expect(lastRes!.statusCode).toBe(429);
      const body = JSON.parse(lastRes!.body);
      expect(body.error.code).toBe('RATE_LIMIT_LOCKED');
      expect(lastRes!.headers['retry-after']).toBeDefined();
    });

    it('TEST 4.2: Repeated failed login attempts trigger HTTP 429 Lockout', async () => {
      resetRateLimits();
      let lastRes;
      for (let i = 0; i < 6; i++) {
        lastRes = await app.inject({
          method: 'POST',
          url: '/api/v1/auth/login',
          payload: { email: 'nonexistent@test.com', password: 'WrongPassword123!' }
        });
      }

      expect(lastRes!.statusCode).toBe(429);
      const body = JSON.parse(lastRes!.body);
      expect(body.error.code).toBe('RATE_LIMIT_LOCKED');
    });
  });

  // =========================================================================
  // SECTION 5: MALICIOUS FILE UPLOAD & MAGIC BYTES VALIDATION
  // =========================================================================
  describe('5. File Upload Security & Magic Byte Signature Validation', () => {
    it('TEST 5.1: Uploading text/executable payload pretending to be PNG is rejected with 400', async () => {
      // Fake PNG header (plain ASCII text in base64)
      const fakePngBase64 = 'data:image/png;base64,' + Buffer.from('<html><script>alert("XSS")</script></html>').toString('base64');

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/settings/logo',
        headers: { cookie: ownerASessionCookie },
        payload: { imageBase64: fakePngBase64 }
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.error.code).toBe('INVALID_IMAGE_SIGNATURE');
    });

    it('TEST 5.2: Path traversal filename in static logo endpoint is rejected with 400', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/uploads/logos/..%2f..%2fpackage.json'
      });

      expect(res.statusCode).toBe(400);
    });

    it('TEST 5.3: Valid PNG with real magic bytes uploads successfully', async () => {
      // Real minimal 1x1 transparent PNG binary bytes
      const validPngBytes = Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
        0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
        0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00,
        0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
        0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49,
        0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82
      ]);
      const validPngBase64 = 'data:image/png;base64,' + validPngBytes.toString('base64');

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/settings/logo',
        headers: { cookie: ownerASessionCookie },
        payload: { imageBase64: validPngBase64 }
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.data.logoUrl).toContain('/api/v1/uploads/logos/logo_');
    });
  });

  // =========================================================================
  // SECTION 6: CONCURRENCY DEFENSE & DOUBLE-SALE RACE CONDITION PREVENTION
  // =========================================================================
  describe('6. Concurrency & Double-Sale Prevention', () => {
    it('TEST 6.1: Attempting to sell an already SOLD item fails with 409 Conflict', async () => {
      const { db } = await getDatabase();
      const itemId = randomUUID();
      const itemCode = `CONC_ITEM_${Date.now()}`;

      await db.insert(schema.jewelleryItems).values({
        id: itemId,
        shopId: shopAId,
        itemCode,
        category: 'BANGLES',
        designTitle: '22K Gold Bangle',
        metal: 'GOLD',
        purity: '22K',
        grossWeight: '12.000',
        netWeight: '12.000',
        status: 'SOLD' // Already marked sold
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/invoices',
        headers: { cookie: ownerASessionCookie },
        payload: {
          customerName: 'Test Buyer',
          customerMobile: '9876543210',
          items: [
            {
              itemId,
              itemCode,
              designTitle: '22K Gold Bangle',
              metal: 'GOLD',
              purity: '22K',
              grossWeight: '12.000',
              netWeight: '12.000',
              rateApplied: '7000'
            }
          ],
          payments: [{ mode: 'CASH', amount: '86520.00' }]
        }
      });

      expect(res.statusCode).toBe(409);
      const body = JSON.parse(res.body);
      expect(body.error.code).toBe('ITEM_ALREADY_SOLD');
    });
  });

  // =========================================================================
  // SECTION 7: SECURITY HEADERS & DEFENSIVE RESPONSES
  // =========================================================================
  describe('7. Security Headers & Error Sanitization', () => {
    it('TEST 7.1: Responses contain essential OWASP security headers', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/health'
      });

      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-frame-options']).toBe('DENY');
      expect(res.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
      expect(res.headers['permissions-policy']).toBeDefined();
    });
  });
});
