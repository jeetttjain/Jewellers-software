import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../server.js';
import { FastifyInstance } from 'fastify';
import { getDatabase } from '../db/connection.js';
import * as schema from '../db/schema/index.js';
import { hashPassword, hashToken } from '../services/crypto.js';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import { ITEM_IMAGE_DIR } from '../services/item_images.service.js';

// Minimal 1x1 valid PNG Base64
const VALID_PNG_BASE64 =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

// Minimal 1x1 valid JPEG Base64
const VALID_JPEG_BASE64 =
  'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';

// Minimal 1x1 valid WEBP Base64
const VALID_WEBP_BASE64 =
  'data:image/webp;base64,UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAgA0JaQAA3AA/vuUAAA=';

// Fake image (text content disguised as PNG)
const FAKE_PNG_BASE64 =
  'data:image/png;base64,SGVsbG8gV29ybGQgVGhpcyBpcyBub3QgYSByZWFsIFBORyBmaWxlIQ==';

describe('Product Image Feature Architecture & Tenant Isolation Tests', () => {
  let app: FastifyInstance;
  let shopAId: string;
  let shopBId: string;
  let ownerACookie: string;
  let ownerBCookie: string;
  let testItemIdA: string;

  beforeAll(async () => {
    app = await buildServer();
    await app.ready();

    const { db } = await getDatabase();

    // Create 2 test shops for strict multi-tenant isolation testing
    shopAId = randomUUID();
    shopBId = randomUUID();

    await db.insert(schema.shops).values([
      {
        id: shopAId,
        name: 'Showroom Alpha',
        code: `ALPHA_${Date.now()}`,
        address: '123 Gold Bazaar, Mumbai',
        city: 'Mumbai',
        stateCode: '27',
        status: 'ACTIVE'
      },
      {
        id: shopBId,
        name: 'Showroom Beta',
        code: `BETA_${Date.now()}`,
        address: '456 Diamond Street, Surat',
        city: 'Surat',
        stateCode: '24',
        status: 'ACTIVE'
      }
    ]);

    const passwordHash = await hashPassword('Owner123!');
    const userAId = randomUUID();
    const userBId = randomUUID();

    await db.insert(schema.users).values([
      { id: userAId, shopId: shopAId, name: 'Admin Alpha', email: `ownerA_${Date.now()}@alpha.com`, passwordHash, role: 'ADMIN' },
      { id: userBId, shopId: shopBId, name: 'Admin Beta', email: `ownerB_${Date.now()}@beta.com`, passwordHash, role: 'ADMIN' }
    ]);

    const tokenA = `token_ownerA_${randomUUID()}`;
    const tokenB = `token_ownerB_${randomUUID()}`;
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await db.insert(schema.sessions).values([
      { userId: userAId, shopId: shopAId, tokenHash: hashToken(tokenA), expiresAt },
      { userId: userBId, shopId: shopBId, tokenHash: hashToken(tokenB), expiresAt }
    ]);

    ownerACookie = `pos_session=${tokenA}`;
    ownerBCookie = `pos_session=${tokenB}`;

    // Create test items for both shops
    const [itemA] = await db
      .insert(schema.jewelleryItems)
      .values({
        shopId: shopAId,
        itemCode: `ITEM-ALPHA-IMG-${Date.now().toString().slice(-4)}`,
        category: 'Necklace',
        designTitle: 'Alpha Royal Choker',
        metal: 'GOLD',
        purity: '22K',
        grossWeight: '20.000',
        stoneWeight: '0.000',
        netWeight: '20.000',
        makingChargeType: 'PER_GRAM',
        makingChargeValue: '450.00',
        status: 'IN_STOCK'
      })
      .returning();
    testItemIdA = itemA.id;

    await db
      .insert(schema.jewelleryItems)
      .values({
        shopId: shopBId,
        itemCode: `ITEM-BETA-IMG-${Date.now().toString().slice(-4)}`,
        category: 'Ring',
        designTitle: 'Beta Solitaire Ring',
        metal: 'GOLD',
        purity: '22K',
        grossWeight: '5.000',
        stoneWeight: '0.000',
        netWeight: '5.000',
        makingChargeType: 'FLAT',
        makingChargeValue: '1000.00',
        status: 'IN_STOCK'
      });
  }, 30000);

  afterAll(async () => {
    if (app) await app.close();
  });

  it('1. Item creation succeeds WITHOUT requiring an image (100% Optional)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/items',
      headers: { cookie: ownerACookie },
      payload: {
        itemCode: `NO-IMG-${Date.now().toString().slice(-5)}`,
        category: 'Earrings',
        designTitle: 'Simple Gold Studs',
        metal: 'GOLD',
        purity: '22K',
        grossWeight: '4.500',
        stoneWeight: '0.000',
        hallmarkVerified: true,
        makingChargeType: 'FLAT',
        makingChargeValue: '500.00'
      }
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.imageUrl).toBeNull();
  });

  it('2. Uploads valid PNG image for an existing item', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/items/${testItemIdA}/images`,
      headers: { cookie: ownerACookie },
      payload: {
        imageBase64: VALID_PNG_BASE64,
        label: 'Main',
        isPrimary: true
      }
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.imageUrl).toContain('/api/v1/product-images/');
    expect(body.data.isPrimary).toBe(true);

    // Verify file written to disk
    const filename = path.basename(body.data.imageUrl);
    const fullPath = path.join(ITEM_IMAGE_DIR, filename);
    expect(fs.existsSync(fullPath)).toBe(true);
  });

  it('3. Serves product image asset through authenticated/verified uploads route', async () => {
    // Get item images
    const listRes = await app.inject({
      method: 'GET',
      url: `/api/v1/items/${testItemIdA}/images`,
      headers: { cookie: ownerACookie }
    });

    const listBody = JSON.parse(listRes.payload);
    expect(listBody.success).toBe(true);
    expect(listBody.data.length).toBeGreaterThan(0);

    const targetUrl = listBody.data[0].imageUrl;
    const assetRes = await app.inject({
      method: 'GET',
      url: targetUrl
    });

    expect(assetRes.statusCode).toBe(200);
    expect(assetRes.headers['content-type']).toBe('image/png');
  });

  it('4. Uploads valid JPEG and WEBP images', async () => {
    // JPEG
    const jpegRes = await app.inject({
      method: 'POST',
      url: `/api/v1/items/${testItemIdA}/images`,
      headers: { cookie: ownerACookie },
      payload: {
        imageBase64: VALID_JPEG_BASE64,
        label: 'Hallmark / HUID',
        isPrimary: false
      }
    });
    expect(jpegRes.statusCode).toBe(201);
    const jpegBody = JSON.parse(jpegRes.payload);
    expect(jpegBody.data.label).toBe('Hallmark / HUID');

    // WEBP
    const webpRes = await app.inject({
      method: 'POST',
      url: `/api/v1/items/${testItemIdA}/images`,
      headers: { cookie: ownerACookie },
      payload: {
        imageBase64: VALID_WEBP_BASE64,
        label: 'Back / Clasp',
        isPrimary: false
      }
    });
    expect(webpRes.statusCode).toBe(201);
  });

  it('5. Rejects corrupted binary payload with invalid magic bytes', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/items/${testItemIdA}/images`,
      headers: { cookie: ownerACookie },
      payload: {
        imageBase64: FAKE_PNG_BASE64,
        label: 'Main'
      }
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(false);
    expect(body.error.message).toContain('header signature');
  });

  it('6. Rejects oversized image (> 5MB)', async () => {
    // Create large 6MB buffer with PNG header
    const bigBuf = Buffer.alloc(6 * 1024 * 1024);
    // Write valid PNG header
    bigBuf[0] = 0x89;
    bigBuf[1] = 0x50;
    bigBuf[2] = 0x4e;
    bigBuf[3] = 0x47;
    bigBuf[4] = 0x0d;
    bigBuf[5] = 0x0a;
    bigBuf[6] = 0x1a;
    bigBuf[7] = 0x0a;

    const bigBase64 = `data:image/png;base64,${bigBuf.toString('base64')}`;

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/items/${testItemIdA}/images`,
      headers: { cookie: ownerACookie },
      payload: {
        imageBase64: bigBase64,
        label: 'Oversized'
      }
    });

    expect([400, 413]).toContain(res.statusCode);
  });

  it('7. STRICT TENANT ISOLATION: Shop B cannot upload image to Shop A item', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/items/${testItemIdA}/images`,
      headers: { cookie: ownerBCookie }, // Shop B cookie targeting Shop A item
      payload: {
        imageBase64: VALID_PNG_BASE64,
        label: 'Intruder'
      }
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.payload);
    expect(body.error.message).toContain('not found or does not belong');
  });

  it('8. STRICT TENANT ISOLATION: Shop B cannot delete Shop A image', async () => {
    const listRes = await app.inject({
      method: 'GET',
      url: `/api/v1/items/${testItemIdA}/images`,
      headers: { cookie: ownerACookie }
    });
    const imgId = JSON.parse(listRes.payload).data[0].id;

    const deleteRes = await app.inject({
      method: 'DELETE',
      url: `/api/v1/items/${testItemIdA}/images/${imgId}`,
      headers: { cookie: ownerBCookie } // Shop B cookie
    });

    expect(deleteRes.statusCode).toBe(400);
    const body = JSON.parse(deleteRes.payload);
    expect(body.error.message).toContain('Image not found');
  });

  it('9. Enforces maximum 4 images limit per item', async () => {
    // Current images for testItemIdA is 3 (PNG, JPEG, WEBP).
    // Add 4th image (should succeed)
    const fourthRes = await app.inject({
      method: 'POST',
      url: `/api/v1/items/${testItemIdA}/images`,
      headers: { cookie: ownerACookie },
      payload: {
        imageBase64: VALID_PNG_BASE64,
        label: 'Detail'
      }
    });
    expect(fourthRes.statusCode).toBe(201);

    // Add 5th image (should fail with max 4 images exceeded)
    const fifthRes = await app.inject({
      method: 'POST',
      url: `/api/v1/items/${testItemIdA}/images`,
      headers: { cookie: ownerACookie },
      payload: {
        imageBase64: VALID_PNG_BASE64,
        label: 'Extra'
      }
    });
    expect(fifthRes.statusCode).toBe(400);
    const body = JSON.parse(fifthRes.payload);
    expect(body.error.message).toContain('Maximum limit of 4 images');
  });

  it('10. Primary image demotion: promoting new image demotes previous primary', async () => {
    // List images
    const listRes = await app.inject({
      method: 'GET',
      url: `/api/v1/items/${testItemIdA}/images`,
      headers: { cookie: ownerACookie }
    });
    const images = JSON.parse(listRes.payload).data;
    const nonPrimaryImg = images.find((img: any) => !img.isPrimary);
    expect(nonPrimaryImg).toBeDefined();

    // Replace and make it primary
    const replaceRes = await app.inject({
      method: 'POST',
      url: `/api/v1/items/${testItemIdA}/images`,
      headers: { cookie: ownerACookie },
      payload: {
        imageBase64: VALID_PNG_BASE64,
        label: 'Promoted Primary',
        isPrimary: true,
        replaceImageId: nonPrimaryImg.id
      }
    });

    expect(replaceRes.statusCode).toBe(201);

    // Verify in DB that only 1 image has isPrimary: true
    const { db } = await getDatabase();
    const dbImages = await db
      .select()
      .from(schema.itemImages)
      .where(eq(schema.itemImages.itemId, testItemIdA));

    const primaryCount = dbImages.filter((img: any) => img.isPrimary).length;
    expect(primaryCount).toBe(1);

    // Verify jewellery_items.imageUrl matches new primary
    const [dbItem] = await db
      .select()
      .from(schema.jewelleryItems)
      .where(eq(schema.jewelleryItems.id, testItemIdA));

    const primaryImg = dbImages.find((img: any) => img.isPrimary);
    expect(dbItem.imageUrl).toBe(primaryImg?.imageUrl);
  });

  it('11. Safely deletes an image and unlinks file from disk', async () => {
    const listRes = await app.inject({
      method: 'GET',
      url: `/api/v1/items/${testItemIdA}/images`,
      headers: { cookie: ownerACookie }
    });
    const images = JSON.parse(listRes.payload).data;
    const targetToDelete = images[0];
    const filename = path.basename(targetToDelete.imageUrl);
    const diskPath = path.join(ITEM_IMAGE_DIR, filename);

    const delRes = await app.inject({
      method: 'DELETE',
      url: `/api/v1/items/${testItemIdA}/images/${targetToDelete.id}`,
      headers: { cookie: ownerACookie }
    });

    expect(delRes.statusCode).toBe(200);
    expect(JSON.parse(delRes.payload).data.removed).toBe(true);

    // Verify file unlinked from disk
    expect(fs.existsSync(diskPath)).toBe(false);
  });

  it('12. Audit trail is generated on image operations', async () => {
    const { db } = await getDatabase();
    const logs = await db
      .select()
      .from(schema.auditLogs)
      .where(eq(schema.auditLogs.shopId, shopAId));

    const imageActions = logs.filter((l: any) =>
      ['ITEM_IMAGE_ADDED', 'ITEM_IMAGE_REPLACED', 'ITEM_IMAGE_REMOVED'].includes(l.action)
    );

    expect(imageActions.length).toBeGreaterThan(0);
    expect(imageActions[0].actorRole).toBe('ADMIN');
    expect(imageActions[0].entityName).toBe('JewelleryItem');
  });
});
