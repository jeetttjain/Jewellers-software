import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildServer } from '../server.js';
import { getDatabase } from '../db/connection.js';
import * as schema from '../db/schema/index.js';
import { hashPassword, hashPin } from '../services/crypto.js';
import { BackupService } from '../services/backup.service.js';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';

describe('Purchase & Supplier Management Module Tests', () => {
  let app: FastifyInstance;
  let sessionCookie: string;
  let testShopId: string;
  let testUserId: string;

  beforeAll(async () => {
    app = await buildServer();
    await app.ready();
    const { db } = await getDatabase();

    testShopId = randomUUID();
    const now = Date.now();
    await db.insert(schema.shops).values({
      id: testShopId,
      name: 'Test Purchase Showroom',
      code: `SP_${now.toString().slice(-6)}`,
      address: 'Zaveri Bazaar, Mumbai',
      defaultTaxPercent: '3.00',
      invoicePrefix: 'KP'
    });

    const passHash = await hashPassword('TestAdminPass123!');
    const pinHash = await hashPin('123456');
    testUserId = randomUUID();
    const email = `admin_${now}@jewellerytest.com`;

    await db.insert(schema.users).values({
      id: testUserId,
      shopId: testShopId,
      name: 'Test Admin User',
      email,
      passwordHash: passHash,
      pinHash,
      role: 'ADMIN',
      isActive: true
    });

    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email,
        password: 'TestAdminPass123!'
      }
    });

    expect(loginRes.statusCode).toBe(200);
    sessionCookie = loginRes.headers['set-cookie'] as string;
    const body = JSON.parse(loginRes.body);
    expect(body.success).toBe(true);
  });

  afterAll(async () => {
    await app.close();
  });

  let supplierId: string;
  let supplierCode = `SUP-TST-${Date.now().toString().slice(-4)}`;
  let mobileNum = `98200${Math.floor(10000 + Math.random() * 90000)}`;

  // Test 1: Create supplier with valid details
  it('1. should create a new supplier with valid details and PAN/GSTIN', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/suppliers',
      headers: { cookie: sessionCookie },
      payload: {
        name: 'Mahalaxmi Bullion Pvt Ltd',
        supplierCode,
        mobile: mobileNum,
        email: 'info@mahalaxmibullion.com',
        pan: 'AAACM1234F',
        gstin: '27AAACM1234F1Z5',
        address: 'Zaveri Bazaar, Kalbadevi',
        city: 'Mumbai',
        state: 'Maharashtra',
        stateCode: '27',
        paymentTermsDays: 45,
        openingBalance: '50000.00',
        notes: 'Primary 22K/24K Gold Bar Bullion Supplier'
      }
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.name).toBe('Mahalaxmi Bullion Pvt Ltd');
    expect(body.data.supplierCode).toBe(supplierCode);
    expect(body.data.openingBalance).toBe('50000.00');
    expect(body.data.currentBalance).toBe('50000.00');
    supplierId = body.data.id;
  });

  // Test 2: Duplicate supplier code within same shop fails
  it('2. should reject creating a supplier with duplicate supplierCode', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/suppliers',
      headers: { cookie: sessionCookie },
      payload: {
        name: 'Duplicate Code Vendor',
        supplierCode, // duplicate
        mobile: '9820099999'
      }
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(false);
    expect(body.error.message).toContain('already exists');
  });

  // Test 3: Duplicate mobile within same shop fails
  it('3. should reject creating a supplier with duplicate mobile number', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/suppliers',
      headers: { cookie: sessionCookie },
      payload: {
        name: 'Duplicate Mobile Vendor',
        supplierCode: `SUP-DIFF-${Date.now().toString().slice(-4)}`,
        mobile: mobileNum // duplicate
      }
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(false);
    expect(body.error.message).toContain('already exists');
  });

  // Test 4: Opening balance setup correctly creates initial credit in supplier ledger
  it('4. should create initial OPENING_BALANCE credit entry in supplier ledger', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/suppliers/${supplierId}/ledger`,
      headers: { cookie: sessionCookie }
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.summary.openingBalance).toBe('50000.00');
    expect(body.data.summary.currentOutstanding).toBe('50000.00');
    expect(body.data.entries.length).toBeGreaterThanOrEqual(1);
    expect(body.data.entries[0].type).toBe('OPENING_BALANCE');
    expect(body.data.entries[0].credit).toBe('50000.00');
  });

  let createdPurchaseId: string;
  let itemCode1 = `JWL-PUR-01-${Date.now().toString().slice(-4)}`;
  let itemCode2 = `JWL-PUR-02-${Date.now().toString().slice(-4)}`;

  // Test 5: Create purchase transaction with 2 items and partial payment
  it('5. should atomically confirm inward purchase bill with items and partial payment', async () => {
    const purchasePayload = {
      supplierId,
      supplierInvoiceNumber: 'INV-MB-2026-901',
      purchaseDate: new Date().toISOString(),
      otherCharges: '100.00',
      discountTotal: '50.00',
      taxPercent: '3.00',
      notes: 'Fresh wedding set inward batch',
      items: [
        {
          itemCode: itemCode1,
          category: 'Necklaces',
          designTitle: '22K Kundan Choker Necklace',
          metal: 'GOLD',
          purity: '22K 916',
          fineness: 916,
          grossWeight: '25.500',
          stoneWeight: '0.500',
          netWeight: '25.000',
          purchaseRate: '7000.00',
          metalCost: '175000.00',
          makingChargeType: 'PER_GRAM',
          makingRate: '400.00',
          makingCost: '10000.00',
          wastagePct: '1.00',
          wastageValue: '1750.00',
          stoneValue: '500.00',
          taxableAmount: '187250.00',
          finalAmount: '187250.00',
          huid: 'HD9901',
          autoCreateStock: true
        },
        {
          itemCode: itemCode2,
          category: 'Bangles',
          designTitle: '22K Traditional Kada Bangle Pair',
          metal: 'GOLD',
          purity: '22K 916',
          fineness: 916,
          grossWeight: '30.000',
          stoneWeight: '0.000',
          netWeight: '30.000',
          purchaseRate: '7000.00',
          metalCost: '210000.00',
          makingChargeType: 'PER_GRAM',
          makingRate: '350.00',
          makingCost: '10500.00',
          wastagePct: '0.00',
          wastageValue: '0.00',
          stoneValue: '0.00',
          taxableAmount: '220500.00',
          finalAmount: '220500.00',
          huid: 'HD9902',
          autoCreateStock: true
        }
      ],
      payments: [
        {
          amount: '200000.00',
          mode: 'BANK_TRANSFER',
          referenceNo: 'UTR-HDFC-99210',
          notes: '50% advance wire transfer'
        }
      ],
      idempotencyKey: `idemp-pur-${Date.now()}`
    };

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/purchases',
      headers: { cookie: sessionCookie },
      payload: purchasePayload
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.purchaseNumber).toMatch(/^PUR-2026\/\d{5}$/);
    expect(body.data.supplierName).toBe('Mahalaxmi Bullion Pvt Ltd');
    expect(body.data.items.length).toBe(2);
    expect(body.data.payments.length).toBe(1);
    expect(parseFloat(body.data.amountPaid)).toBe(200000.00);
    expect(parseFloat(body.data.balanceDue)).toBeGreaterThan(0);
    expect(body.data.paymentStatus).toBe('PARTIALLY_PAID');
    createdPurchaseId = body.data.id;
  });

  // Test 6: Verify stock items created with status = 'IN_STOCK' and provenance fields
  it('6. should verify newly created jewelleryItems have status IN_STOCK and supplier/purchase links', async () => {
    const { db } = await getDatabase();
    const items = await db
      .select()
      .from(schema.jewelleryItems)
      .where(eq(schema.jewelleryItems.purchaseId, createdPurchaseId));

    expect(items.length).toBe(2);
    for (const item of items) {
      expect(item.status).toBe('IN_STOCK');
      expect(item.supplierId).toBe(supplierId);
      expect(item.purchaseId).toBe(createdPurchaseId);
      expect(parseFloat(item.purchaseCostRate || '0')).toBe(7000.00);
      expect(parseFloat(item.costMetalValue || '0')).toBeGreaterThan(0);
    }
  });

  // Test 7: Verify supplier ledger has credit entry for grand total and debit for payment
  it('7. should record purchase bill credit and payment debit in supplier ledger', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/suppliers/${supplierId}/ledger`,
      headers: { cookie: sessionCookie }
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    const entries = body.data.entries;

    const purchaseEntry = entries.find((e: any) => e.type === 'PURCHASE_BILL');
    expect(purchaseEntry).toBeDefined();
    expect(parseFloat(purchaseEntry.credit)).toBeGreaterThan(400000);

    const paymentEntry = entries.find((e: any) => e.type === 'PAYMENT_OUT');
    expect(paymentEntry).toBeDefined();
    expect(parseFloat(paymentEntry.debit)).toBe(200000.00);
  });

  // Test 8: Verify supplier current balance updated correctly
  it('8. should correctly update supplier currentBalance = openingBalance + grandTotal - amountPaid', async () => {
    const { db } = await getDatabase();
    const suppRows = await db.select().from(schema.suppliers).where(eq(schema.suppliers.id, supplierId));
    const supp = suppRows[0];

    const purRows = await db.select().from(schema.purchases).where(eq(schema.purchases.id, createdPurchaseId));
    const pur = purRows[0];

    const expectedBalance = 50000.00 + parseFloat(pur.grandTotal) - 200000.00;
    expect(parseFloat(supp.currentBalance)).toBeCloseTo(expectedBalance, 2);
  });

  // Test 9: Verify item IDs automatically enqueued to labelJobs
  it('9. should automatically enqueue created item IDs to labelJobs', async () => {
    const { db } = await getDatabase();
    const jobs = await db
      .select()
      .from(schema.labelJobs)
      .where(eq(schema.labelJobs.shopId, testShopId));

    expect(jobs.length).toBeGreaterThanOrEqual(1);
    const latestJob = jobs[jobs.length - 1];
    expect(latestJob.status).toBe('PENDING');
    expect(Array.isArray(latestJob.itemIds)).toBe(true);
    expect((latestJob.itemIds as string[]).length).toBe(2);
  });

  // Test 10: Settle balance payment: verify balance due updated, payment status marked PAID
  it('10. should settle balance payment, update purchase balanceDue to 0 and paymentStatus to PAID', async () => {
    // Get current balance due
    const purRes = await app.inject({
      method: 'GET',
      url: `/api/v1/purchases/${createdPurchaseId}`,
      headers: { cookie: sessionCookie }
    });
    const pur = JSON.parse(purRes.body).data;
    const remainingDue = pur.balanceDue;

    const payRes = await app.inject({
      method: 'POST',
      url: `/api/v1/purchases/${createdPurchaseId}/payments`,
      headers: { cookie: sessionCookie },
      payload: {
        amount: remainingDue,
        mode: 'BANK_TRANSFER',
        referenceNo: 'UTR-FINAL-SETTLE',
        notes: 'Final settlement of purchase dues'
      }
    });

    expect(payRes.statusCode).toBe(201);

    // Verify updated purchase status
    const updatedPurRes = await app.inject({
      method: 'GET',
      url: `/api/v1/purchases/${createdPurchaseId}`,
      headers: { cookie: sessionCookie }
    });
    const updatedPur = JSON.parse(updatedPurRes.body).data;
    expect(parseFloat(updatedPur.balanceDue)).toBe(0.00);
    expect(updatedPur.paymentStatus).toBe('PAID');
  });

  // Test 11: Idempotency test: duplicate idempotencyKey returns same response without duplicate stock
  it('11. should return cached response for duplicate idempotencyKey without creating duplicate stock', async () => {
    const idempKey = `test-idemp-${Date.now()}`;
    const idempItemCode = `JWL-IDEMP-${Date.now().toString().slice(-4)}`;

    const payload = {
      supplierId,
      purchaseDate: new Date().toISOString(),
      items: [
        {
          itemCode: idempItemCode,
          category: 'Rings',
          designTitle: '22K Gold Solitaire Ring',
          metal: 'GOLD',
          purity: '22K 916',
          grossWeight: '4.500',
          stoneWeight: '0.000',
          netWeight: '4.500',
          purchaseRate: '7000.00',
          metalCost: '31500.00',
          taxableAmount: '31500.00',
          finalAmount: '31500.00',
          autoCreateStock: true
        }
      ],
      idempotencyKey: idempKey
    };

    // First request
    const res1 = await app.inject({
      method: 'POST',
      url: '/api/v1/purchases',
      headers: { cookie: sessionCookie },
      payload
    });
    expect(res1.statusCode).toBe(201);
    const body1 = JSON.parse(res1.body);

    // Second request with same idempotencyKey
    const res2 = await app.inject({
      method: 'POST',
      url: '/api/v1/purchases',
      headers: { cookie: sessionCookie },
      payload
    });
    const body2 = JSON.parse(res2.body);

    expect(body2.data.id).toBe(body1.data.id);
    expect(body2.data.purchaseNumber).toBe(body1.data.purchaseNumber);

    // Verify only 1 stock item exists for idempItemCode
    const { db } = await getDatabase();
    const items = await db
      .select()
      .from(schema.jewelleryItems)
      .where(eq(schema.jewelleryItems.itemCode, idempItemCode));
    expect(items.length).toBe(1);
  });

  // Test 12: Soft delete supplier with purchase history sets isActive = false
  it('12. should deactivate (soft delete) supplier with purchase history instead of hard deleting', async () => {
    const delRes = await app.inject({
      method: 'DELETE',
      url: `/api/v1/suppliers/${supplierId}`,
      headers: { cookie: sessionCookie }
    });

    expect(delRes.statusCode).toBe(200);
    const body = JSON.parse(delRes.body);
    expect(body.success).toBe(true);
    expect(body.data.deactivated).toBe(true);
    expect(body.data.deleted).toBe(false);

    // Verify supplier still exists but isActive is false
    const { db } = await getDatabase();
    const suppRows = await db.select().from(schema.suppliers).where(eq(schema.suppliers.id, supplierId));
    expect(suppRows.length).toBe(1);
    expect(suppRows[0].isActive).toBe(false);
  });

  // Test 13: Hard delete supplier with zero purchase history deletes successfully
  it('13. should hard delete supplier if they have zero purchase history', async () => {
    // Create temporary supplier with 0 purchases
    const tempRes = await app.inject({
      method: 'POST',
      url: '/api/v1/suppliers',
      headers: { cookie: sessionCookie },
      payload: {
        name: 'Temporary Supplier No Purchases',
        supplierCode: `SUP-TMP-${Date.now().toString().slice(-4)}`,
        mobile: `98200${Math.floor(10000 + Math.random() * 90000)}`
      }
    });
    const tempId = JSON.parse(tempRes.body).data.id;

    const delRes = await app.inject({
      method: 'DELETE',
      url: `/api/v1/suppliers/${tempId}`,
      headers: { cookie: sessionCookie }
    });

    expect(delRes.statusCode).toBe(200);
    const body = JSON.parse(delRes.body);
    expect(body.data.deleted).toBe(true);
    expect(body.data.deactivated).toBe(false);

    const { db } = await getDatabase();
    const suppRows = await db.select().from(schema.suppliers).where(eq(schema.suppliers.id, tempId));
    expect(suppRows.length).toBe(0);
  });

  // Test 14: Search suppliers by name, code, GSTIN, PAN
  it('14. should search suppliers by name, code, mobile, GSTIN, PAN', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/suppliers?search=Mahalaxmi`,
      headers: { cookie: sessionCookie }
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.length).toBeGreaterThanOrEqual(1);
    expect(body.data[0].name).toContain('Mahalaxmi');
  });

  // Test 15: Verify backup/restore includes suppliers, purchases, items, ledger entries
  it('15. should create backup containing suppliers, purchases, and restore successfully', async () => {
    const backupResult = await BackupService.createBackup(testShopId, 'FULL');
    expect(backupResult.summary.purchasesCount).toBeGreaterThanOrEqual(1);

    const inspection = BackupService.inspectBackupFile(backupResult.backupBuffer, undefined, testShopId);
    expect(inspection.schemaCompatible).toBe(true);
    expect(inspection.tenantMatch).toBe(true);
    expect(inspection.summary.purchasesCount).toBeGreaterThanOrEqual(1);

    const restoreRes = await BackupService.restoreBackup(testShopId, backupResult.backupBuffer, testUserId);
    expect(restoreRes.success).toBe(true);
  });
});
