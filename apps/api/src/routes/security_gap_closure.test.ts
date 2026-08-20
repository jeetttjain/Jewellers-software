import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { buildServer } from '../server.js';
import { FastifyInstance } from 'fastify';
import { getDatabase } from '../db/connection.js';
import * as schema from '../db/schema/index.js';
import { hashPassword, hashPin } from '../services/crypto.js';
import { resetRateLimits } from '../middleware/rateLimit.js';
import { randomUUID } from 'crypto';

describe('SECOND INDEPENDENT PRODUCTION SECURITY GAP CLOSURE SUITE', () => {
  let app: FastifyInstance;
  let shopAId: string;
  let shopBId: string;
  let ownerAUserId: string;
  let cashierAUserId: string;

  let ownerASessionCookie: string;
  let cashierASessionCookie: string;

  const validOwnerPin = '123456';

  beforeAll(async () => {
    app = await buildServer();
    await app.ready();
    const { db } = await getDatabase();

    const now = Date.now();
    shopAId = randomUUID();
    await db.insert(schema.shops).values({
      id: shopAId,
      name: 'Security Showroom A',
      code: `GAP_A_${now}`,
      address: 'Zaveri Bazaar, Mumbai',
      defaultTaxPercent: '3.00',
      invoicePrefix: 'GA'
    });

    const ownerAPass = await hashPassword('OwnerPass123!');
    const ownerAPin = await hashPin(validOwnerPin);
    ownerAUserId = randomUUID();
    const ownerAEmail = `ownera_${now}@gaptest.com`;
    await db.insert(schema.users).values({
      id: ownerAUserId,
      shopId: shopAId,
      name: 'Owner A User',
      email: ownerAEmail,
      passwordHash: ownerAPass,
      pinHash: ownerAPin,
      role: 'ADMIN',
      isActive: true
    });

    const cashierAPass = await hashPassword('CashierPass123!');
    const cashierAPin = await hashPin('5566');
    cashierAUserId = randomUUID();
    const cashierAEmail = `cashiera_${now}@gaptest.com`;
    await db.insert(schema.users).values({
      id: cashierAUserId,
      shopId: shopAId,
      name: 'Cashier A User',
      email: cashierAEmail,
      passwordHash: cashierAPass,
      pinHash: cashierAPin,
      role: 'CLERK',
      isActive: true
    });

    shopBId = randomUUID();
    await db.insert(schema.shops).values({
      id: shopBId,
      name: 'Security Showroom B',
      code: `GAP_B_${now}`,
      address: 'Karol Bagh, Delhi',
      defaultTaxPercent: '3.00',
      invoicePrefix: 'GB'
    });

    // Obtain Session Cookies via Login
    const loginResA = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: ownerAEmail, password: 'OwnerPass123!' }
    });
    ownerASessionCookie = loginResA.headers['set-cookie'] as string;

    const loginResCashier = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: cashierAEmail, password: 'CashierPass123!' }
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
  // 1. SQL INJECTION & MALICIOUS INPUT IMMUNITY
  // =========================================================================
  describe('1. SQL Injection & Malicious Input Defense', () => {
    const maliciousPayloads = [
      "' OR '1'='1",
      "'; DROP TABLE jewellery_items; --",
      "' UNION SELECT id, email, password_hash FROM users --",
      "admin' --",
      "\" OR \"\"=\"",
      "1; SELECT pg_sleep(5); --",
      "1' OR 1=1--",
      "1' OR '1'='1' /*"
    ];

    it('TEST 1.1: Customer Search query with SQL injection payloads yields no unauthorized data or SQL error', async () => {
      for (const payload of maliciousPayloads) {
        const res = await app.inject({
          method: 'GET',
          url: `/api/v1/customers?search=${encodeURIComponent(payload)}`,
          headers: { cookie: ownerASessionCookie }
        });

        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body.success).toBe(true);
        // Expect empty array or safe match, never database error or table dump
        expect(Array.isArray(body.data)).toBe(true);
        expect(res.body).not.toContain('syntax error');
        expect(res.body).not.toContain('pg_catalog');
      }
    });

    it('TEST 1.2: Customer creation with SQL injection payloads is safely parameterized', async () => {
      let idx = 0;
      for (const payload of maliciousPayloads) {
        idx++;
        const res = await app.inject({
          method: 'POST',
          url: '/api/v1/customers',
          headers: { cookie: ownerASessionCookie },
          payload: {
            name: `Test Customer ${idx} ${payload}`,
            mobile: `987654321${idx % 10}`,
            address: payload,
            city: 'Mumbai',
            pincode: '400002'
          }
        });

        // Either validated or stored safely as a literal string
        if (res.statusCode === 201) {
          const body = JSON.parse(res.body);
          expect(body.data.name).toContain(payload);
        } else {
          expect(res.statusCode).toBe(400);
        }
        expect(res.body).not.toContain('syntax error');
      }
    });

    it('TEST 1.3: Invoice ID lookup with SQL injection payload returns 404 cleanly', async () => {
      for (const payload of maliciousPayloads) {
        const res = await app.inject({
          method: 'GET',
          url: `/api/v1/invoices/${encodeURIComponent(payload)}`,
          headers: { cookie: ownerASessionCookie }
        });

        expect([400, 404]).toContain(res.statusCode);
        expect(res.body).not.toContain('syntax error');
      }
    });
  });

  // =========================================================================
  // 2. XSS STORED & REFLECTED PAYLOAD RESISTANCE
  // =========================================================================
  describe('2. XSS Stored & Reflected Payload Defense', () => {
    const xssPayloads = [
      '<script>alert("XSS")</script>',
      '<img src=x onerror=alert(1)>',
      '"><svg onload=alert(1)>',
      'javascript:alert(1)',
      '<iframe src="javascript:alert(1)">'
    ];

    it('TEST 2.1: Customer Name and Address store XSS payloads as harmless literal text', async () => {
      let idx = 0;
      for (const xss of xssPayloads) {
        idx++;
        const res = await app.inject({
          method: 'POST',
          url: '/api/v1/customers',
          headers: { cookie: ownerASessionCookie },
          payload: {
            name: `XSS Name ${idx} ${xss}`,
            mobile: `981122334${idx % 10}`,
            address: xss,
            city: 'Mumbai',
            pincode: '400001'
          }
        });

        if (res.statusCode === 201) {
          const body = JSON.parse(res.body);
          expect(body.data.name).toBe(`XSS Name ${idx} ${xss}`);
          // Header check: Content-Type is application/json (cannot execute as HTML in browser)
          expect(res.headers['content-type']).toContain('application/json');
        }
      }
    });
  });

  // =========================================================================
  // 3. CORS & ORIGIN RESTRICTION
  // =========================================================================
  describe('3. CORS Origin Validation & Credential Protection', () => {
    it('TEST 3.1: Preflight request from unauthorized origin is rejected', async () => {
      const res = await app.inject({
        method: 'OPTIONS',
        url: '/api/v1/invoices',
        headers: {
          origin: 'https://evil-hacker-site.com',
          'access-control-request-method': 'POST',
          'access-control-request-headers': 'Content-Type'
        }
      });

      const allowedOrigin = res.headers['access-control-allow-origin'];
      expect(allowedOrigin).not.toBe('https://evil-hacker-site.com');
      expect(allowedOrigin).not.toBe('*');
    });

    it('TEST 3.2: Allowed origin receives appropriate Access-Control headers', async () => {
      const res = await app.inject({
        method: 'OPTIONS',
        url: '/api/v1/invoices',
        headers: {
          origin: 'http://localhost:5173',
          'access-control-request-method': 'POST',
          'access-control-request-headers': 'Content-Type'
        }
      });

      expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
      expect(res.headers['access-control-allow-credentials']).toBe('true');
    });
  });

  // =========================================================================
  // 4. FINANCIAL BUSINESS LOGIC & COMPLIANCE DEFENSES
  // =========================================================================
  describe('4. Financial Business Logic & Compliance Hardening', () => {
    it('TEST 4.1: Negative gross weight in invoice creation is rejected with 400 Bad Request', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/invoices',
        headers: { cookie: ownerASessionCookie },
        payload: {
          customerName: 'Fraud Attacker',
          customerMobile: '9876543210',
          items: [
            {
              itemCode: 'NEG_WT_01',
              designTitle: 'Invalid Ring',
              metal: 'GOLD',
              purity: '22K',
              grossWeight: -10.500, // Negative weight attack
              netWeight: -10.500,
              rateApplied: 7500
            }
          ],
          payments: [{ mode: 'CASH', amount: '1000' }]
        }
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(false);
    });

    it('TEST 4.2: Negative rateApplied in invoice creation is rejected with 400 Bad Request', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/invoices',
        headers: { cookie: ownerASessionCookie },
        payload: {
          customerName: 'Negative Price Attacker',
          customerMobile: '9876543210',
          items: [
            {
              itemCode: 'NEG_RATE_01',
              designTitle: 'Negative Gold Rate Item',
              metal: 'GOLD',
              purity: '22K',
              grossWeight: 10.000,
              netWeight: 10.000,
              rateApplied: -7500 // Negative price attack
            }
          ],
          payments: [{ mode: 'CASH', amount: '1000' }]
        }
      });

      expect(res.statusCode).toBe(400);
    });

    it('TEST 4.3: Cash transactions exceeding ₹2,00,000 without PAN are rejected (Rule 114B Compliance)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/invoices',
        headers: { cookie: ownerASessionCookie },
        payload: {
          customerName: 'High Value Cash Customer',
          customerMobile: '9876543210',
          // Omitted customerPan
          items: [
            {
              itemCode: 'GOLD_BAR_01',
              designTitle: '24K Gold Bar 100g',
              metal: 'GOLD',
              purity: '24K',
              grossWeight: 40.000,
              netWeight: 40.000,
              rateApplied: 7500 // 40g * 7500 = ₹3,00,000 + GST
            }
          ],
          payments: [{ mode: 'CASH', amount: '309000.00' }]
        }
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.error.code).toBe('COMPLIANCE_VIOLATION');
      expect(body.error.message).toContain('Rule 114B');
    });

    it('TEST 4.4: Cash payments exceeding ₹2,00,000 are rejected (Section 269ST Compliance)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/invoices',
        headers: { cookie: ownerASessionCookie },
        payload: {
          customerName: 'Section 269ST Client',
          customerMobile: '9876543210',
          customerPan: 'ABCDE1234F',
          items: [
            {
              itemCode: 'GOLD_BAR_02',
              designTitle: '24K Gold Bar',
              metal: 'GOLD',
              purity: '24K',
              grossWeight: 30.000,
              netWeight: 30.000,
              rateApplied: 7500
            }
          ],
          payments: [{ mode: 'CASH', amount: '225000.00' }] // Exceeds ₹2L cash limit
        }
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.error.code).toBe('COMPLIANCE_VIOLATION');
      expect(body.error.message).toContain('Section 269ST');
    });
  });

  // =========================================================================
  // 5. IDEMPOTENCY ENFORCEMENT
  // =========================================================================
  describe('5. Idempotency & Duplicate Transaction Protection', () => {
    it('TEST 5.1: Duplicate invoice submission with same Idempotency-Key returns cached original invoice without double-charging', async () => {
      const idempotencyKey = `idemp_${Date.now()}_${randomUUID()}`;
      const payload = {
        idempotencyKey,
        customerName: 'Idempotency Test Client',
        customerMobile: '9876543210',
        items: [
          {
            itemCode: `IDEMP_ITEM_${Date.now()}`,
            designTitle: 'Idempotency Gold Pendant',
            metal: 'GOLD',
            purity: '22K',
            grossWeight: 5.000,
            netWeight: 5.000,
            rateApplied: 7000
          }
        ],
        payments: [{ mode: 'UPI', amount: '36050.00' }]
      };

      // First Request
      const res1 = await app.inject({
        method: 'POST',
        url: '/api/v1/invoices',
        headers: {
          cookie: ownerASessionCookie,
          'idempotency-key': idempotencyKey
        },
        payload
      });

      expect(res1.statusCode).toBe(201);
      const body1 = JSON.parse(res1.body);
      const invoiceId1 = body1.data.id;
      const invoiceNumber1 = body1.data.invoiceNumber;

      // Second Duplicate Request (Network Retry Simulation)
      const res2 = await app.inject({
        method: 'POST',
        url: '/api/v1/invoices',
        headers: {
          cookie: ownerASessionCookie,
          'idempotency-key': idempotencyKey
        },
        payload
      });

      expect(res2.statusCode).toBe(201);
      const body2 = JSON.parse(res2.body);
      expect(body2.data.id).toBe(invoiceId1);
      expect(body2.data.invoiceNumber).toBe(invoiceNumber1);
    });
  });

  // =========================================================================
  // 6. ROLE PRIVILEGE SEPARATION & TAMPERING RESISTANCE
  // =========================================================================
  describe('6. Privilege Separation & Role Tampering Defense', () => {
    it('TEST 6.1: Cashier (CLERK) cannot alter Showroom Owner PIN', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/settings/owner-pin/setup',
        headers: { cookie: cashierASessionCookie },
        payload: { pin: '999999' }
      });

      expect(res.statusCode).toBe(403);
      const body = JSON.parse(res.body);
      expect(body.code).toBe('FORBIDDEN');
    });

    it('TEST 6.2: Frontend cannot forge shopId in customer creation', async () => {
      // Cashier of Shop A attempts to create a customer for Shop B
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/customers',
        headers: { cookie: cashierASessionCookie },
        payload: {
          shopId: shopBId, // Injected shopId
          name: 'Tampered Customer',
          mobile: '9123456789'
        }
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      // Server must have forced shopId to Shop A (the authenticated user's shop)
      expect(body.data.shopId).toBe(shopAId);
      expect(body.data.shopId).not.toBe(shopBId);
    });
  });
});
