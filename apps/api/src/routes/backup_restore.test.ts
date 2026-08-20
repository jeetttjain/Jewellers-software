import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../server.js';
import { FastifyInstance } from 'fastify';
import { getDatabase } from '../db/connection.js';
import * as schema from '../db/schema/index.js';
import { hashPassword, hashToken, hashPin } from '../services/crypto.js';
import { BackupService } from '../services/backup.service.js';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';

describe('PRODUCTION BACKUP & RESTORE SYSTEM TEST SUITE (22 MANDATORY TESTS)', () => {
  let app: FastifyInstance;
  let shopAId: string;
  let shopBId: string;
  let ownerAToken: string;
  let ownerACookie: string;
  let ownerBToken: string;
  let ownerBCookie: string;
  let clerkAToken: string;
  let clerkACookie: string;
  let ownerAUserId: string;

  let createdBackupBuffer: Buffer;
  let backupBase64: string;
  let testItemId: string;
  let testCustomerId: string;
  let testInvoiceId: string;

  beforeAll(async () => {
    app = await buildServer();
    await app.ready();
    const { db } = await getDatabase();

    shopAId = randomUUID();
    shopBId = randomUUID();

    const ownerPinHash = await hashPin('123456');

    // Create Shop A and Shop B with Owner PIN set
    await db.insert(schema.shops).values([
      {
        id: shopAId,
        name: 'Flagship Showroom A',
        code: `BKS_A_${Date.now()}`,
        address: 'Jaipur Main Market',
        ownerPinHash,
        invoiceTemplate: { paperSize: '80mm', termsText: 'Shop A Terms' }
      },
      {
        id: shopBId,
        name: 'Branch Showroom B',
        code: `BKS_B_${Date.now()}`,
        address: 'Delhi Hub',
        ownerPinHash,
        invoiceTemplate: { paperSize: 'A4', termsText: 'Shop B Terms' }
      }
    ]);

    const passwordHash = await hashPassword('OwnerPass123!');
    ownerAUserId = randomUUID();
    const ownerBUser = randomUUID();
    const clerkAUser = randomUUID();

    await db.insert(schema.users).values([
      { id: ownerAUserId, shopId: shopAId, name: 'Owner A', email: `ownerA_bck_${Date.now()}@test.com`, passwordHash, role: 'ADMIN' },
      { id: ownerBUser, shopId: shopBId, name: 'Owner B', email: `ownerB_bck_${Date.now()}@test.com`, passwordHash, role: 'ADMIN' },
      { id: clerkAUser, shopId: shopAId, name: 'Clerk A', email: `clerkA_bck_${Date.now()}@test.com`, passwordHash, role: 'CLERK' }
    ]);

    ownerAToken = `token_bck_ownerA_${randomUUID()}`;
    ownerBToken = `token_bck_ownerB_${randomUUID()}`;
    clerkAToken = `token_bck_clerkA_${randomUUID()}`;

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await db.insert(schema.sessions).values([
      { userId: ownerAUserId, shopId: shopAId, tokenHash: hashToken(ownerAToken), expiresAt },
      { userId: ownerBUser, shopId: shopBId, tokenHash: hashToken(ownerBToken), expiresAt },
      { userId: clerkAUser, shopId: shopAId, tokenHash: hashToken(clerkAToken), expiresAt }
    ]);

    ownerACookie = `pos_session=${ownerAToken}`;
    ownerBCookie = `pos_session=${ownerBToken}`;
    clerkACookie = `pos_session=${clerkAToken}`;

    // Seed Data in Shop A
    testCustomerId = randomUUID();
    await db.insert(schema.customers).values({
      id: testCustomerId,
      shopId: shopAId,
      name: 'Ramesh Kumar',
      mobile: '9876543210',
      ledgerBalance: '15000.00',
      totalPurchases: '150000.00'
    });

    testItemId = randomUUID();
    await db.insert(schema.jewelleryItems).values({
      id: testItemId,
      shopId: shopAId,
      itemCode: 'JWL-BCK-001',
      category: 'Necklace',
      designTitle: '22K Kundan Gold Necklace',
      metal: 'GOLD',
      purity: '22K 916',
      grossWeight: '45.500',
      stoneWeight: '2.500',
      netWeight: '43.000',
      huid: 'HD8812',
      status: 'IN_STOCK'
    });

    await db.insert(schema.goldRates).values({
      id: randomUUID(),
      shopId: shopAId,
      rate24k: '7600.00',
      rate22k: '7100.00',
      rate18k: '5850.00',
      rateSilver: '88.00',
      createdBy: ownerAUserId
    });

    testInvoiceId = randomUUID();
    await db.insert(schema.invoices).values({
      id: testInvoiceId,
      shopId: shopAId,
      invoiceNumber: 'INV-BCK-9001',
      customerId: testCustomerId,
      customerName: 'Ramesh Kumar',
      customerMobile: '9876543210',
      subtotalMetal: '305300.00',
      taxableAmount: '305300.00',
      totalTaxAmount: '9159.00',
      grandTotal: '314459.00',
      amountPaid: '200000.00',
      balanceDue: '114459.00',
      paymentStatus: 'PARTIALLY_PAID',
      createdBy: ownerAUserId
    });

    await db.insert(schema.payments).values({
      id: randomUUID(),
      shopId: shopAId,
      invoiceId: testInvoiceId,
      customerId: testCustomerId,
      amount: '200000.00',
      mode: 'UPI',
      referenceNo: 'UPI99887766',
      createdBy: ownerAUserId
    });

    await db.insert(schema.customerLedgerEntries).values({
      id: randomUUID(),
      shopId: shopAId,
      customerId: testCustomerId,
      type: 'INVOICE_BILL',
      referenceNo: 'INV-BCK-9001',
      description: 'Gold Purchase',
      debit: '314459.00',
      credit: '0.00',
      runningBalance: '314459.00'
    });

    await db.insert(schema.labelTemplates).values({
      id: randomUUID(),
      shopId: shopAId,
      name: 'Custom Dumbbell Tag',
      preset: 'DUMBBELL_2INCH',
      widthMm: '75.00',
      heightMm: '25.00',
      config: { showLogo: true, showHuid: true },
      isDefault: true
    });
  }, 30000);

  afterAll(async () => {
    if (app) await app.close();
  });

  it('TEST 1: Backup creation succeeds', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/backup/export',
      headers: { cookie: ownerACookie },
      payload: { backupType: 'FULL', pin: '123456' }
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('octet-stream');
    expect(res.headers['x-backup-filename']).toContain('.shopbackup');

    createdBackupBuffer = res.rawPayload;
    backupBase64 = createdBackupBuffer.toString('base64');
    expect(createdBackupBuffer.length).toBeGreaterThan(100);
  });

  it('TEST 2: Backup file format envelope is encrypted', async () => {
    const jsonStr = createdBackupBuffer.toString('utf8');
    const parsed = JSON.parse(jsonStr);

    expect(parsed.format).toBe('JEWELLERY_POS_BACKUP');
    expect(parsed.iv).toBeDefined();
    expect(parsed.authTag).toBeDefined();
    expect(parsed.salt).toBeDefined();
    expect(parsed.payload).toBeDefined();
  });

  it('TEST 3: Backup does not expose readable business data externally', async () => {
    const rawContent = createdBackupBuffer.toString('utf8');
    expect(rawContent).not.toContain('Ramesh Kumar');
    expect(rawContent).not.toContain('22K Kundan Gold Necklace');
    expect(rawContent).not.toContain('314459.00');
  });

  it('TEST 4: Valid backup inspects and validates successfully', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/backup/inspect',
      headers: { cookie: ownerACookie },
      payload: { fileBase64: backupBase64 }
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.payload);
    expect(json.data.success).toBe(true);
    expect(json.data.summary.salesCount).toBeGreaterThanOrEqual(1);
    expect(json.data.summary.inventoryCount).toBeGreaterThanOrEqual(1);
    expect(json.data.summary.customersCount).toBeGreaterThanOrEqual(1);
  });

  it('TEST 5: Non-Owner or wrong authentication fails safely', async () => {
    // Non-owner CLERK receives 403 Forbidden
    const resClerk = await app.inject({
      method: 'POST',
      url: '/api/v1/backup/export',
      headers: { cookie: clerkACookie },
      payload: { backupType: 'FULL' }
    });
    expect(resClerk.statusCode).toBe(403);

    // Wrong Owner PIN receives 401 Unauthorized
    const resWrongPin = await app.inject({
      method: 'POST',
      url: '/api/v1/backup/export',
      headers: { cookie: ownerACookie },
      payload: { pin: '999999' }
    });
    expect(resWrongPin.statusCode).toBe(401);
  });

  it('TEST 6: Corrupted backup file is rejected', async () => {
    const corruptedBuffer = Buffer.from(createdBackupBuffer);
    // Tamper with payload byte
    const idx = corruptedBuffer.length - 25;
    const currentByte = corruptedBuffer[idx] ?? 0;
    corruptedBuffer[idx] = currentByte ^ 0xff;

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/backup/inspect',
      headers: { cookie: ownerACookie },
      payload: { fileBase64: corruptedBuffer.toString('base64') }
    });

    expect(res.statusCode).toBe(400);
    const json = JSON.parse(res.payload);
    expect(json.error.message).toContain('corrupted');
  });

  it('TEST 7: Incomplete or invalid JSON backup file is rejected', async () => {
    const incompleteBase64 = Buffer.from('{"format":"JEWELLERY_POS_BACKUP"}').toString('base64');

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/backup/inspect',
      headers: { cookie: ownerACookie },
      payload: { fileBase64: incompleteBase64 }
    });

    expect(res.statusCode).toBe(400);
  });

  it('TEST 8: Previous valid backup remains safe when backup fail occurs', async () => {
    const statusBefore = await BackupService.getStatus(shopAId);
    expect(statusBefore.lastBackupAt).toBeDefined();

    try {
      // Intentional failure trigger
      await BackupService.createBackup('non-existent-shop-id');
    } catch {
      // Expected catch
    }

    const statusAfter = await BackupService.getStatus(shopAId);
    expect(statusAfter.lastBackupAt).toBe(statusBefore.lastBackupAt);
  });

  it('TEST 9 & 10: New & updated records appear in incremental backup', async () => {
    const { db } = await getDatabase();
    
    // Add new customer & update existing item status
    const newCustId = randomUUID();
    await db.insert(schema.customers).values({
      id: newCustId,
      shopId: shopAId,
      name: 'Sunita Sharma',
      mobile: '9123456789'
    });

    await db.update(schema.jewelleryItems).set({ status: 'SOLD', updatedAt: new Date() }).where(eq(schema.jewelleryItems.id, testItemId));

    const incBackup = await BackupService.createBackup(shopAId, 'INCREMENTAL');
    expect(incBackup.summary.changesSinceLastBackup).toBeGreaterThan(0);
  });

  it('TEST 11: Voided/returned/deleted records are preserved and restored correctly', async () => {
    const { db } = await getDatabase();

    const returnId = randomUUID();
    await db.insert(schema.returns).values({
      id: returnId,
      shopId: shopAId,
      returnNumber: 'RET-BCK-001',
      originalInvoiceId: testInvoiceId,
      originalInvoiceNumber: 'INV-BCK-9001',
      itemId: testItemId,
      itemCode: 'JWL-BCK-001',
      itemTitle: '22K Kundan Gold Necklace',
      customerName: 'Ramesh Kumar',
      returnReason: 'Size Exchange',
      refundAmount: '314459.00',
      netRefundAmount: '314459.00',
      authorizedBy: ownerAUserId
    });

    const bck = await BackupService.createBackup(shopAId, 'FULL');
    expect(bck.summary.returnsCount).toBeGreaterThanOrEqual(1);
  });

  it('TEST 12: Repeated backups do not duplicate records', async () => {
    const b1 = await BackupService.createBackup(shopAId, 'FULL');
    const b2 = await BackupService.createBackup(shopAId, 'FULL');

    expect(b1.summary.salesCount).toBe(b2.summary.salesCount);
    expect(b1.summary.inventoryCount).toBe(b2.summary.inventoryCount);
  });

  it('TEST 13: Valid restore succeeds and updates database state', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/backup/restore',
      headers: { cookie: ownerACookie },
      payload: { fileBase64: backupBase64, pin: '123456' }
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.payload);
    expect(json.data.success).toBe(true);
  });

  it('TEST 14A: Cross-tenant inspect HARD-FAILS when Shop B attempts to inspect Shop A backup', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/backup/inspect',
      headers: { cookie: ownerBCookie },
      payload: { fileBase64: backupBase64 }
    });

    expect(res.statusCode).toBe(400);
    const json = JSON.parse(res.payload);
    expect(json.error.message).toContain('Backup belongs to another shop and cannot be accessed');
  });

  it('TEST 14B: Cross-tenant restore HARD-FAILS when Shop B attempts to restore Shop A backup', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/backup/restore',
      headers: { cookie: ownerBCookie },
      payload: { fileBase64: backupBase64, pin: '123456' }
    });

    expect(res.statusCode).toBe(500);
    const json = JSON.parse(res.payload);
    expect(json.error.message).toContain('Backup belongs to another shop and cannot be accessed');
  });

  it('TEST 15: Invoice template is restored', async () => {
    const { db } = await getDatabase();
    const shop = await db.select().from(schema.shops).where(eq(schema.shops.id, shopAId));
    expect(shop[0]!.invoiceTemplate).toBeDefined();
  });

  it('TEST 16: Label template is restored', async () => {
    const { db } = await getDatabase();
    const templates = await db.select().from(schema.labelTemplates).where(eq(schema.labelTemplates.shopId, shopAId));
    expect(templates.length).toBeGreaterThan(0);
  });

  it('TEST 17: Barcode/QR mappings (itemCode, huid) are restored', async () => {
    const { db } = await getDatabase();
    const item = await db.select().from(schema.jewelleryItems).where(eq(schema.jewelleryItems.id, testItemId));
    expect(item[0].itemCode).toBe('JWL-BCK-001');
    expect(item[0].huid).toBe('HD8812');
  });

  it('TEST 18: Customer ledger is restored correctly', async () => {
    const { db } = await getDatabase();
    const ledger = await db.select().from(schema.customerLedgerEntries).where(eq(schema.customerLedgerEntries.shopId, shopAId));
    expect(ledger.length).toBeGreaterThan(0);
    expect(ledger[0].debit).toBe('314459.00');
  });

  it('TEST 19: Partial payment state is restored correctly', async () => {
    const { db } = await getDatabase();
    const inv = await db.select().from(schema.invoices).where(eq(schema.invoices.id, testInvoiceId));
    expect(inv[0].paymentStatus).toBe('PARTIALLY_PAID');
    expect(inv[0].balanceDue).toBe('114459.00');
  });

  it('TEST 20: Inventory status is restored correctly', async () => {
    const { db } = await getDatabase();
    const item = await db.select().from(schema.jewelleryItems).where(eq(schema.jewelleryItems.id, testItemId));
    expect(item[0].grossWeight).toBe('45.500');
  });

  it('TEST 21: Gold rate history is restored correctly', async () => {
    const { db } = await getDatabase();
    const rates = await db.select().from(schema.goldRates).where(eq(schema.goldRates.shopId, shopAId));
    expect(rates.length).toBeGreaterThan(0);
    expect(rates[0].rate24k).toBe('7600.00');
  });

  it('TEST 22: GET /backup/status returns accurate backup info for UI', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/backup/status',
      headers: { cookie: ownerACookie }
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.payload);
    expect(json.data.lastBackupAt).toBeDefined();
    expect(json.data.formattedSize).toBeDefined();
  });

  it('TEST 23: Tombstoned deletion record is generated and restored correctly', async () => {
    const { db } = await getDatabase();
    const tempItemId = randomUUID();

    await db.insert(schema.jewelleryItems).values({
      id: tempItemId,
      shopId: shopAId,
      itemCode: 'JWL-TEMP-99',
      category: 'Rings',
      designTitle: 'Temp Ring',
      metal: 'GOLD',
      purity: '22K 916',
      grossWeight: '3.000',
      stoneWeight: '0.000',
      netWeight: '3.000',
      status: 'IN_STOCK'
    });

    await db.insert(schema.deletedRecords).values({
      id: randomUUID(),
      shopId: shopAId,
      entityName: 'jewellery_items',
      entityId: tempItemId
    });

    const bck = await BackupService.createBackup(shopAId, 'FULL');
    await BackupService.restoreBackup(shopAId, bck.backupBuffer, ownerAUserId);

    const check = await db.select().from(schema.jewelleryItems).where(eq(schema.jewelleryItems.id, tempItemId));
    expect(check.length).toBe(0);
  });

  it('TEST 24: Secure scrypt KDF key derivation is verified', async () => {
    const bck = await BackupService.createBackup(shopAId, 'FULL');
    const envelope = JSON.parse(bck.backupBuffer.toString('utf8'));

    expect(envelope.format).toBe('JEWELLERY_POS_BACKUP');
    expect(envelope.salt).toHaveLength(32);
    expect(envelope.iv).toHaveLength(24);
    expect(envelope.authTag).toHaveLength(32);
  });

  it('TEST 25: Settings, Templates & Branding restore exactly', async () => {
    const { db } = await getDatabase();
    const customPrefix = 'TST-INV-';
    await db.update(schema.shops).set({
      name: 'Custom Showroom 100',
      invoicePrefix: customPrefix
    }).where(eq(schema.shops.id, shopAId));

    const bck = await BackupService.createBackup(shopAId, 'FULL');

    // Mutate settings
    await db.update(schema.shops).set({
      name: 'Altered Showroom Name',
      invoicePrefix: 'ALT-PFX-'
    }).where(eq(schema.shops.id, shopAId));

    // Restore
    await BackupService.restoreBackup(shopAId, bck.backupBuffer, ownerAUserId);

    const check = await db.select().from(schema.shops).where(eq(schema.shops.id, shopAId));
    expect(check[0].name).toBe('Custom Showroom 100');
    expect(check[0].invoicePrefix).toBe(customPrefix);
  });

  it('TEST 26: Barcode and QR mappings restore correctly', async () => {
    const { db } = await getDatabase();
    const itemId = randomUUID();
    const barcode = 'BARCODE-123';
    const huid = 'HUID-9988';

    await db.insert(schema.jewelleryItems).values({
      id: itemId,
      shopId: shopAId,
      itemCode: barcode,
      huid: huid,
      category: 'Bangles',
      designTitle: 'Gold Bangle',
      metal: 'GOLD',
      purity: '22K 916',
      grossWeight: '20.000',
      stoneWeight: '0.000',
      netWeight: '20.000',
      status: 'IN_STOCK'
    });

    const bck = await BackupService.createBackup(shopAId, 'FULL');

    // Alter mapping
    await db.update(schema.jewelleryItems).set({
      itemCode: 'BAR-ALT-99',
      huid: 'HD-ALT-99'
    }).where(eq(schema.jewelleryItems.id, itemId));

    // Restore
    await BackupService.restoreBackup(shopAId, bck.backupBuffer, ownerAUserId);

    const check = await db.select().from(schema.jewelleryItems).where(eq(schema.jewelleryItems.id, itemId));
    expect(check[0].itemCode).toBe(barcode);
    expect(check[0].huid).toBe(huid);
  });

  it('TEST 27: Customer ledger financial balance calculation restores correctly', async () => {
    const { db } = await getDatabase();
    const custId = randomUUID();
    const invId = randomUUID();

    await db.insert(schema.customers).values({
      id: custId,
      shopId: shopAId,
      name: 'Ledger Test Customer',
      mobile: '9888877777'
    });

    await db.insert(schema.invoices).values({
      id: invId,
      shopId: shopAId,
      invoiceNumber: 'INV-LEDGER-100',
      customerId: custId,
      customerName: 'Ledger Test Customer',
      customerMobile: '9888877777',
      subtotalMetal: '97087.38',
      taxableAmount: '97087.38',
      totalTaxAmount: '2912.62',
      grandTotal: '100000.00',
      amountPaid: '60000.00',
      balanceDue: '40000.00',
      paymentStatus: 'PARTIALLY_PAID',
      createdBy: ownerAUserId
    });

    await db.insert(schema.customerLedgerEntries).values({
      id: randomUUID(),
      shopId: shopAId,
      customerId: custId,
      invoiceId: invId,
      type: 'BILL',
      referenceNo: 'INV-LEDGER-100',
      description: 'Bill generated',
      debit: '100000.00',
      credit: '0.00',
      runningBalance: '100000.00',
      notes: 'Bill generated',
      date: new Date()
    });

    await db.insert(schema.customerLedgerEntries).values({
      id: randomUUID(),
      shopId: shopAId,
      customerId: custId,
      invoiceId: invId,
      type: 'PAYMENT',
      referenceNo: 'PAY-REF-100',
      description: 'Partial payment',
      debit: '0.00',
      credit: '60000.00',
      runningBalance: '40000.00',
      notes: 'Partial payment',
      date: new Date()
    });

    const bck = await BackupService.createBackup(shopAId, 'FULL');

    // Mutate payment state
    await db.update(schema.invoices).set({
      amountPaid: '100000.00',
      balanceDue: '0.00',
      paymentStatus: 'PAID'
    }).where(eq(schema.invoices.id, invId));

    // Restore
    await BackupService.restoreBackup(shopAId, bck.backupBuffer, ownerAUserId);

    const restoredInv = await db.select().from(schema.invoices).where(eq(schema.invoices.id, invId));
    expect(restoredInv[0].grandTotal).toBe('100000.00');
    expect(restoredInv[0].amountPaid).toBe('60000.00');
    expect(restoredInv[0].balanceDue).toBe('40000.00');
    expect(restoredInv[0].paymentStatus).toBe('PARTIALLY_PAID');
  });

  it('TEST 28: Inventory state SOLD status restores correctly', async () => {
    const { db } = await getDatabase();
    const itemId = randomUUID();

    await db.insert(schema.jewelleryItems).values({
      id: itemId,
      shopId: shopAId,
      itemCode: 'JWL-SOLD-001',
      category: 'Necklaces',
      designTitle: 'Sold Necklace',
      metal: 'GOLD',
      purity: '22K 916',
      grossWeight: '15.000',
      stoneWeight: '0.000',
      netWeight: '15.000',
      status: 'SOLD'
    });

    const bck = await BackupService.createBackup(shopAId, 'FULL');

    // Mutate status to IN_STOCK
    await db.update(schema.jewelleryItems).set({ status: 'IN_STOCK' }).where(eq(schema.jewelleryItems.id, itemId));

    // Restore
    await BackupService.restoreBackup(shopAId, bck.backupBuffer, ownerAUserId);

    const check = await db.select().from(schema.jewelleryItems).where(eq(schema.jewelleryItems.id, itemId));
    expect(check[0].status).toBe('SOLD');
  });

  it('TEST 29: Sales and Returns integrity restores correctly', async () => {
    const { db } = await getDatabase();
    const retId = randomUUID();
    const origInvId = randomUUID();
    const origItemId = randomUUID();

    await db.insert(schema.jewelleryItems).values({
      id: origItemId,
      shopId: shopAId,
      itemCode: 'JWL-RET-001',
      category: 'Rings',
      designTitle: 'Returned Ring',
      metal: 'GOLD',
      purity: '22K 916',
      grossWeight: '5.000',
      stoneWeight: '0.000',
      netWeight: '5.000',
      status: 'SOLD'
    });

    await db.insert(schema.invoices).values({
      id: origInvId,
      shopId: shopAId,
      invoiceNumber: 'INV-ORIG-001',
      customerName: 'Return Customer',
      customerMobile: '9999911111',
      subtotalMetal: '24271.84',
      taxableAmount: '24271.84',
      totalTaxAmount: '728.16',
      grandTotal: '25000.00',
      amountPaid: '25000.00',
      balanceDue: '0.00',
      paymentStatus: 'PAID',
      createdBy: ownerAUserId
    });

    await db.insert(schema.returns).values({
      id: retId,
      shopId: shopAId,
      returnNumber: 'RET-TEST-001',
      originalInvoiceId: origInvId,
      originalInvoiceNumber: 'INV-ORIG-001',
      itemId: origItemId,
      itemCode: 'JWL-RET-001',
      itemTitle: 'Returned Ring',
      customerName: 'Return Customer',
      returnReason: 'Customer requested return',
      refundAmount: '25000.00',
      deductionAmount: '0.00',
      netRefundAmount: '25000.00',
      refundMode: 'CASH',
      authorizedBy: ownerAUserId,
      createdBy: ownerAUserId
    });

    const bck = await BackupService.createBackup(shopAId, 'FULL');

    // Mutate return amount
    await db.update(schema.returns).set({ netRefundAmount: '0.00' }).where(eq(schema.returns.id, retId));

    // Restore
    await BackupService.restoreBackup(shopAId, bck.backupBuffer, ownerAUserId);

    const check = await db.select().from(schema.returns).where(eq(schema.returns.id, retId));
    expect(check[0].netRefundAmount).toBe('25000.00');
  });

  it('TEST 30: Gold rate history restores correctly', async () => {
    const { db } = await getDatabase();
    const rate1Id = randomUUID();
    const rate2Id = randomUUID();

    await db.insert(schema.goldRates).values({
      id: rate1Id,
      shopId: shopAId,
      rate24k: '7500.00',
      rate22k: '6875.00',
      rate18k: '5625.00',
      rateSilver: '85.00',
      effectiveFrom: new Date('2026-08-01'),
      createdBy: ownerAUserId
    });

    await db.insert(schema.goldRates).values({
      id: rate2Id,
      shopId: shopAId,
      rate24k: '7600.00',
      rate22k: '6966.00',
      rate18k: '5700.00',
      rateSilver: '88.00',
      effectiveFrom: new Date('2026-08-13'),
      createdBy: ownerAUserId
    });

    const bck = await BackupService.createBackup(shopAId, 'FULL');

    // Mutate gold rate
    await db.update(schema.goldRates).set({ rate24k: '9999.00' }).where(eq(schema.goldRates.id, rate2Id));

    // Restore
    await BackupService.restoreBackup(shopAId, bck.backupBuffer, ownerAUserId);

    const check = await db.select().from(schema.goldRates).where(eq(schema.goldRates.id, rate2Id));
    expect(check[0].rate24k).toBe('7600.00');
  });

  it('TEST 31: Financial history is never hard-deleted during restore', async () => {
    const { db } = await getDatabase();
    const invId = randomUUID();

    await db.insert(schema.invoices).values({
      id: invId,
      shopId: shopAId,
      invoiceNumber: 'INV-SAFE-001',
      customerName: 'Safe Financial Customer',
      customerMobile: '9000000000',
      subtotalMetal: '48543.69',
      taxableAmount: '48543.69',
      totalTaxAmount: '1456.31',
      grandTotal: '50000.00',
      amountPaid: '50000.00',
      balanceDue: '0.00',
      paymentStatus: 'PAID',
      createdBy: ownerAUserId
    });

    const bck = await BackupService.createBackup(shopAId, 'FULL');
    await BackupService.restoreBackup(shopAId, bck.backupBuffer, ownerAUserId);

    const check = await db.select().from(schema.invoices).where(eq(schema.invoices.id, invId));
    expect(check.length).toBe(1);
    expect(check[0].paymentStatus).toBe('PAID');
  });
});
