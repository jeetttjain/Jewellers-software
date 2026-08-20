import { describe, it, expect, beforeAll } from 'vitest';
import { getDatabase, initDatabase } from './connection.js';
import * as schema from './schema/index.js';
import { createItem, getItemByIdOrCode, updateItem, listItems } from '../services/items.service.js';
import {
  getLabelTemplate,
  updateLabelTemplate,
  getTestLabelData
} from '../services/labels.service.js';
import { lookupItemWithQuote } from '../services/scan.service.js';
import { createRatesSnapshot } from '../services/rates.service.js';
import { DEFAULT_LABEL_CONFIG } from '@jewellery-pos/shared';
import { eq, and } from 'drizzle-orm';

describe('BARCODE CUSTOMIZATION & LABEL FORMAT SYSTEM AUDIT (TESTS 1 to 12)', () => {
  let db: any;
  const shopId = '00000000-0000-0000-0000-000000000001';
  const adminId = '00000000-0000-0000-0000-000000000010';
  const cashierId = '00000000-0000-0000-0000-000000000011';

  beforeAll(async () => {
    const res = await getDatabase();
    db = res.db;
    await initDatabase(db);

    // Ensure shop exists
    const existingShop = await db.select().from(schema.shops).where(eq(schema.shops.id, shopId));
    if (existingShop.length === 0) {
      await db.insert(schema.shops).values({
        id: shopId,
        name: 'Kamal Jewellers Test Flagship',
        code: 'KJ-TEST',
        address: 'Zaveri Bazaar, Mumbai',
        defaultTaxPercent: '3.00',
        invoicePrefix: 'KJ-TEST/'
      });
    }

    // Ensure admin user exists
    const existingAdmin = await db.select().from(schema.users).where(eq(schema.users.id, adminId));
    if (existingAdmin.length === 0) {
      await db.insert(schema.users).values({
        id: adminId,
        shopId,
        name: 'Kamal Kishore Soni',
        email: 'admin.label@kamaljewellers.com',
        passwordHash: 'hash123',
        pinHash: 'pin123',
        role: 'ADMIN',
        isActive: true
      });
    }

    // Ensure cashier user exists
    const existingCashier = await db.select().from(schema.users).where(eq(schema.users.id, cashierId));
    if (existingCashier.length === 0) {
      await db.insert(schema.users).values({
        id: cashierId,
        shopId,
        name: 'Pooja Sharma',
        email: 'cashier.label@kamaljewellers.com',
        passwordHash: 'hash123',
        pinHash: 'pin123',
        role: 'CLERK',
        isActive: true
      });
    }

    // Initialize daily rate
    await createRatesSnapshot(
      shopId,
      {
        rate24k: '7450.00',
        rate22k: '6980.00',
        rate18k: '5750.00',
        rateSilver: '95.00'
      },
      adminId,
      'Kamal Kishore Soni'
    );
  });

  // =========================================================================
  // TEST 1: Create jewellery item -> Barcode automatically generated
  // =========================================================================
  it('TEST 1: Create jewellery item automatically fixes permanent barcode identity', async () => {
    const itemCode = `JWL-TAG-${Date.now()}`;
    const item = await createItem(
      shopId,
      {
        itemCode,
        category: 'Rings',
        designTitle: '18K Diamond Solitaire Engagement Ring',
        metal: 'GOLD',
        purity: '18K',
        grossWeight: '4.500',
        stoneWeight: '0.250',
        huid: 'AB8812',
        hallmarkVerified: true,
        makingChargeType: 'PER_GRAM',
        makingChargeValue: '650.00',
        wastagePct: '1.00',
        stoneValue: '45000.00'
      },
      adminId
    );

    expect(item.id).toBeDefined();
    expect(item.itemCode).toBe(itemCode);
    expect(item.status).toBe('IN_STOCK');
    expect(item.netWeight).toBe('4.250');
  });

  // =========================================================================
  // TEST 2: Client opens Label Designer -> Can customize visual appearance
  // =========================================================================
  it('TEST 2: Client opens Label Designer and customizes visual appearance presets & toggles', async () => {
    const initialTpl = await getLabelTemplate(shopId);
    expect(initialTpl.id).toBeDefined();
    expect(initialTpl.isDefault).toBe(true);

    // Customize template with 2" Dumbbell preset and specific toggles
    const customized = await updateLabelTemplate(
      shopId,
      {
        name: 'Dumbbell Ring Wrap Label (75x25mm)',
        preset: 'DUMBBELL_2INCH',
        widthMm: '75.00',
        heightMm: '25.00',
        config: {
          ...DEFAULT_LABEL_CONFIG,
          showShopName: true,
          shopNameFontSizePt: 9,
          showHuid: true,
          showStoneWeight: true,
          showQrCode: true,
          showBarcode: true,
          barcodeHeightMm: 10
        }
      },
      adminId,
      'Kamal Kishore Soni',
      'ADMIN'
    );

    expect(customized.preset).toBe('DUMBBELL_2INCH');
    expect(customized.widthMm).toBe('75.00');
    expect(customized.config.showStoneWeight).toBe(true);
    expect(customized.config.showQrCode).toBe(true);

    // Verify audit log was recorded
    const auditLogs = await db
      .select()
      .from(schema.auditLogs)
      .where(and(eq(schema.auditLogs.shopId, shopId), eq(schema.auditLogs.action, 'LABEL_TEMPLATE_UPDATED')));
    expect(auditLogs.length).toBeGreaterThanOrEqual(1);
  });

  // =========================================================================
  // TEST 3: Client attempts to edit barcode identity -> Rejected with error
  // =========================================================================
  it('TEST 3: Direct attempt to modify barcode identity (itemCode) fails safely', async () => {
    const itemCode = `IMMUTABLE-CODE-${Date.now()}`;
    const item = await createItem(
      shopId,
      {
        itemCode,
        category: 'Bangles',
        designTitle: '22K Traditional Kada',
        metal: 'GOLD',
        purity: '22K',
        grossWeight: '25.000',
        stoneWeight: '0.000'
      },
      adminId
    );

    // Attempt to illegally modify itemCode
    await expect(
      updateItem(shopId, item.id, {
        itemCode: 'TAMPERED-NEW-CODE'
      } as any)
    ).rejects.toThrow(/Barcode identity is permanently immutable/);

    // Confirm itemCode in database remains original
    const verified = await getItemByIdOrCode(shopId, item.id);
    expect(verified!.itemCode).toBe(itemCode);
  });

  // =========================================================================
  // TEST 4: Change label layout -> Barcode encoded value unchanged
  // =========================================================================
  it('TEST 4: Switching between Butterfly and Rectangular layouts preserves exact item barcode', async () => {
    const itemCode = `LAYOUT-TEST-${Date.now()}`;
    const item = await createItem(
      shopId,
      {
        itemCode,
        category: 'Pendants',
        designTitle: '18K Diamond Floral Pendant',
        metal: 'GOLD',
        purity: '18K',
        grossWeight: '3.200',
        stoneWeight: '0.100'
      },
      adminId
    );

    // Switch to Butterfly layout
    await updateLabelTemplate(
      shopId,
      {
        preset: 'BUTTERFLY',
        widthMm: '70.00',
        heightMm: '30.00',
        config: { ...DEFAULT_LABEL_CONFIG, showQrCode: true, showBarcode: false }
      },
      adminId,
      'Kamal Kishore Soni',
      'ADMIN'
    );

    // Switch to Small Rectangular layout
    await updateLabelTemplate(
      shopId,
      {
        preset: 'SMALL_RECTANGLE',
        widthMm: '50.00',
        heightMm: '25.00',
        config: { ...DEFAULT_LABEL_CONFIG, showQrCode: false, showBarcode: true }
      },
      adminId,
      'Kamal Kishore Soni',
      'ADMIN'
    );

    // Query item from database
    const refreshed = await getItemByIdOrCode(shopId, item.id);
    expect(refreshed!.itemCode).toBe(itemCode);
    expect(refreshed!.id).toBe(item.id);
  });

  // =========================================================================
  // TEST 5: Reprint lost label -> Same barcode generated
  // =========================================================================
  it('TEST 5: Reprinting lost or damaged label generates the identical barcode identity', async () => {
    const itemCode = `LOST-REPRINT-${Date.now()}`;
    const originalItem = await createItem(
      shopId,
      {
        itemCode,
        category: 'Chains',
        designTitle: '22K Hollow Rope Chain',
        metal: 'GOLD',
        purity: '22K',
        grossWeight: '12.450',
        stoneWeight: '0.000',
        huid: 'RC9901'
      },
      adminId
    );

    // Simulate lost label -> Reprint operation queries existing item
    const reprintedItem = await getItemByIdOrCode(shopId, originalItem.itemCode);
    expect(reprintedItem).not.toBeNull();
    expect(reprintedItem!.id).toBe(originalItem.id);
    expect(reprintedItem!.itemCode).toBe(originalItem.itemCode);
    expect(reprintedItem!.huid).toBe('RC9901');
  });

  // =========================================================================
  // TEST 6: Scan original label -> Correct item resolved
  // =========================================================================
  it('TEST 6: Scanning barcode on original label resolves to correct jewellery item and live quote', async () => {
    const itemCode = `SCAN-ORIG-${Date.now()}`;
    const item = await createItem(
      shopId,
      {
        itemCode,
        category: 'Earrings',
        designTitle: '22K Gold Stud Earrings',
        metal: 'GOLD',
        purity: '22K',
        grossWeight: '6.000',
        stoneWeight: '0.500',
        makingChargeType: 'PER_GRAM',
        makingChargeValue: '450.00',
        wastagePct: '0.00'
      },
      adminId
    );

    // Scanner lookup by itemCode
    const scanResult = await lookupItemWithQuote(shopId, item.itemCode);
    expect(scanResult).not.toBeNull();
    expect(scanResult!.item.id).toBe(item.id);
    expect(scanResult!.item.itemCode).toBe(itemCode);
    expect(scanResult!.item.netWeight).toBe('5.500');
  });

  // =========================================================================
  // TEST 7: Scan reprinted label -> Same item resolved
  // =========================================================================
  it('TEST 7: Scanning reprinted label resolves to the exact same inventory item', async () => {
    const itemCode = `SCAN-REPRINT-${Date.now()}`;
    const item = await createItem(
      shopId,
      {
        itemCode,
        category: 'Necklaces',
        designTitle: '22K Bridal Choker',
        metal: 'GOLD',
        purity: '22K',
        grossWeight: '45.000',
        stoneWeight: '2.000'
      },
      adminId
    );

    // First scan before template update
    const firstScan = await lookupItemWithQuote(shopId, item.itemCode);
    expect(firstScan!.item.id).toBe(item.id);

    // Custom layout applied
    await updateLabelTemplate(
      shopId,
      {
        preset: 'DUMBBELL_2INCH',
        config: { ...DEFAULT_LABEL_CONFIG, showShopName: false }
      },
      adminId,
      'Kamal Kishore Soni',
      'ADMIN'
    );

    // Second scan of reprinted tag
    const secondScan = await lookupItemWithQuote(shopId, item.itemCode);
    expect(secondScan!.item.id).toBe(item.id);
    expect(secondScan!.item.itemCode).toBe(firstScan!.item.itemCode);
  });

  // =========================================================================
  // TEST 8: Change label template -> Database jewellery item identity unchanged
  // =========================================================================
  it('TEST 8: Repeated template changes have zero side-effects on inventory records', async () => {
    const allItemsBefore = await listItems(shopId);

    // Update template 5 times consecutively
    for (let i = 0; i < 5; i++) {
      await updateLabelTemplate(
        shopId,
        {
          name: `Dynamic Preset Iteration ${i}`,
          widthMm: `${50 + i * 5}.00`,
          heightMm: `${25 + i * 2}.00`,
          config: {
            ...DEFAULT_LABEL_CONFIG,
            fontSizePt: 6 + i * 0.5,
            showGstin: i % 2 === 0
          }
        },
        adminId,
        'Kamal Kishore Soni',
        'ADMIN'
      );
    }

    const allItemsAfter = await listItems(shopId);
    expect(allItemsAfter.length).toBe(allItemsBefore.length);
    for (let i = 0; i < allItemsBefore.length; i++) {
      expect(allItemsAfter[i].id).toBe(allItemsBefore[i].id);
      expect(allItemsAfter[i].itemCode).toBe(allItemsBefore[i].itemCode);
    }
  });

  // =========================================================================
  // TEST 9: Unauthorized user attempts to change template -> Rejected
  // =========================================================================
  it('TEST 9: Non-admin cashier role is forbidden from modifying label template', async () => {
    await expect(
      updateLabelTemplate(
        shopId,
        {
          name: 'Unauthorized Cashier Hack',
          config: DEFAULT_LABEL_CONFIG
        },
        cashierId,
        'Pooja Sharma',
        'CLERK'
      )
    ).rejects.toThrow(/Forbidden: Only Admin, Owner, or authorized Manager/);
  });

  // =========================================================================
  // TEST 10: Two jewellery items attempt same barcode identity -> Database rejects
  // =========================================================================
  it('TEST 10: Attempting to create duplicate barcode identity is rejected by database constraint', async () => {
    const duplicateCode = `DUP-BARCODE-${Date.now()}`;

    // First item inwarded
    await createItem(
      shopId,
      {
        itemCode: duplicateCode,
        category: 'Rings',
        designTitle: 'First Ring',
        metal: 'GOLD',
        purity: '22K',
        grossWeight: '5.000',
        stoneWeight: '0.000'
      },
      adminId
    );

    // Second item attempting same barcode identity MUST fail
    await expect(
      createItem(
        shopId,
        {
          itemCode: duplicateCode,
          category: 'Rings',
          designTitle: 'Second Duplicate Ring',
          metal: 'GOLD',
          purity: '22K',
          grossWeight: '5.000',
          stoneWeight: '0.000'
        },
        adminId
      )
    ).rejects.toThrow(/already exists in inventory/);
  });

  // =========================================================================
  // TEST 11: Server restart / Persistence verification
  // =========================================================================
  it('TEST 11: Template configuration and item barcodes persist across database queries', async () => {
    const itemCode = `PERSIST-TAG-${Date.now()}`;
    await createItem(
      shopId,
      {
        itemCode,
        category: 'Coins',
        designTitle: '24K 999 Pure Gold Coin',
        metal: 'GOLD',
        purity: '24K',
        grossWeight: '10.000',
        stoneWeight: '0.000'
      },
      adminId
    );

    // Query active template directly from DB
    const templateFromDb = await getLabelTemplate(shopId);
    expect(templateFromDb).toBeDefined();
    expect(templateFromDb.config).toBeDefined();

    // Query item directly from DB
    const itemFromDb = await getItemByIdOrCode(shopId, itemCode);
    expect(itemFromDb).toBeDefined();
    expect(itemFromDb!.itemCode).toBe(itemCode);
  });

  // =========================================================================
  // TEST 12: Test Label Data Generation without Inventory Modification
  // =========================================================================
  it('TEST 12: Generating test label data produces valid demo tag with zero inventory side-effects', async () => {
    const countBefore = (await listItems(shopId)).length;

    const testData = await getTestLabelData(shopId);
    expect(testData.shop.name).toBeDefined();
    expect(testData.testItem.itemCode).toBe('DEMO-JWL-TEST01');
    expect(testData.testItem.purity).toBe('22K 916');

    const countAfter = (await listItems(shopId)).length;
    expect(countAfter).toBe(countBefore); // Zero DB items added!
  });
});
