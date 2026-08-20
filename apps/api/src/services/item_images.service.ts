import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import { getDatabase } from '../db/connection.js';
import * as schema from '../db/schema/index.js';
import { eq, and, desc, sql } from 'drizzle-orm';
import { ItemImage } from '@jewellery-pos/shared';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
export const ITEM_IMAGE_DIR = path.resolve(currentDir, '../../uploads/items');

export function ensureItemImageDir() {
  if (!fs.existsSync(ITEM_IMAGE_DIR)) {
    fs.mkdirSync(ITEM_IMAGE_DIR, { recursive: true });
  }
}

/**
 * Validates real binary magic bytes for uploaded image buffer.
 */
export function isValidImageSignature(buffer: Buffer, mimeType: string): boolean {
  if (!buffer || buffer.length < 12) return false;

  if (mimeType === 'png') {
    return (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a
    );
  }

  if (mimeType === 'jpeg' || mimeType === 'jpg') {
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }

  if (mimeType === 'webp') {
    const isRiff = buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46;
    const isWebp = buffer.subarray(8, 12).toString('ascii') === 'WEBP';
    return isRiff && isWebp;
  }

  return false;
}

/**
 * Validates image pixel dimensions from header to guard against decompression bombs.
 * Max dimension allowed: 8000 x 8000 px.
 */
export function validateImageDimensions(buffer: Buffer, mimeType: string): boolean {
  const MAX_DIMENSION = 8000;

  try {
    if (mimeType === 'png' && buffer.length >= 24) {
      const width = buffer.readUInt32BE(16);
      const height = buffer.readUInt32BE(20);
      if (width > MAX_DIMENSION || height > MAX_DIMENSION || width === 0 || height === 0) {
        return false;
      }
      return true;
    }

    if (mimeType === 'jpeg' || mimeType === 'jpg') {
      let offset = 2;
      while (offset < buffer.length - 8) {
        if (buffer[offset] !== 0xff) break;
        const marker = buffer[offset + 1];
        if (marker === 0xc0 || marker === 0xc2) {
          const height = buffer.readUInt16BE(offset + 5);
          const width = buffer.readUInt16BE(offset + 7);
          if (width > MAX_DIMENSION || height > MAX_DIMENSION || width === 0 || height === 0) {
            return false;
          }
          return true;
        }
        const length = buffer.readUInt16BE(offset + 2);
        offset += 2 + length;
      }
      return true;
    }

    if (mimeType === 'webp' && buffer.length >= 30) {
      const type = buffer.subarray(12, 16).toString('ascii');
      if (type === 'VP8 ') {
        const width = buffer.readUInt16LE(26) & 0x3fff;
        const height = buffer.readUInt16LE(28) & 0x3fff;
        if (width > MAX_DIMENSION || height > MAX_DIMENSION) return false;
      } else if (type === 'VP8L' && buffer.length >= 25) {
        const b1 = buffer[21] ?? 0;
        const b2 = buffer[22] ?? 0;
        const b3 = buffer[23] ?? 0;
        const b4 = buffer[24] ?? 0;
        const width = 1 + (((b2 & 0x3f) << 8) | b1);
        const height = 1 + (((b4 & 0xf) << 10) | (b3 << 2) | ((b2 & 0xc0) >> 6));
        if (width > MAX_DIMENSION || height > MAX_DIMENSION) return false;
      }
      return true;
    }
  } catch {
    // If parsing fails gracefully permit if signature is valid
    return true;
  }

  return true;
}

export interface UploadImageOptions {
  shopId: string;
  itemId: string;
  imageBase64: string;
  label?: string;
  isPrimary?: boolean;
  replaceImageId?: string;
  user: {
    id: string;
    name: string;
    role: string;
  };
  ipAddress?: string;
}

export async function uploadItemImage(options: UploadImageOptions): Promise<ItemImage> {
  const { shopId, itemId, imageBase64, label = 'Main', replaceImageId, user, ipAddress } = options;
  const isPrimary = options.isPrimary ?? true;

  if (!imageBase64 || typeof imageBase64 !== 'string') {
    throw new Error('Image base64 data payload is required');
  }

  // Parse and validate data URL prefix
  const match = imageBase64.match(/^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/i);
  if (!match) {
    throw new Error('Invalid image format. Only PNG, JPEG, and WEBP images are supported.');
  }

  const rawMime = (match[1] || '').toLowerCase();
  const mimeType = rawMime === 'jpeg' ? 'jpg' : rawMime;
  const base64Data = match[2] || '';
  const buffer = Buffer.from(base64Data, 'base64');

  // Max 5MB file size limit
  const MAX_BYTES = 5 * 1024 * 1024;
  if (buffer.length > MAX_BYTES) {
    throw new Error('Image file size exceeds maximum limit of 5MB.');
  }

  // Validate magic bytes
  if (!isValidImageSignature(buffer, rawMime)) {
    throw new Error('Image contents do not match valid PNG, JPEG, or WEBP binary header signature.');
  }

  // Validate dimensions
  if (!validateImageDimensions(buffer, rawMime)) {
    throw new Error('Image dimensions exceed maximum allowed limits (8000x8000 pixels).');
  }

  const { db } = await getDatabase();

  // Verify item belongs to the authenticated shop
  const itemRows = await db
    .select()
    .from(schema.jewelleryItems)
    .where(and(eq(schema.jewelleryItems.id, itemId), eq(schema.jewelleryItems.shopId, shopId)))
    .limit(1);

  if (itemRows.length === 0) {
    throw new Error('Jewellery item not found or does not belong to the authenticated showroom.');
  }

  // Check existing images count (max 4 per item)
  const existingImages = await db
    .select()
    .from(schema.itemImages)
    .where(and(eq(schema.itemImages.shopId, shopId), eq(schema.itemImages.itemId, itemId)));

  if (!replaceImageId && existingImages.length >= 4) {
    throw new Error('Maximum limit of 4 images per jewellery item has been reached.');
  }

  // Prepare storage file
  ensureItemImageDir();
  const filename = `item_${shopId}_${itemId}_${randomUUID()}.${mimeType}`;
  const filePath = path.join(ITEM_IMAGE_DIR, filename);
  const storagePath = `items/${shopId}/${itemId}/${filename}`;
  const imageUrl = `/api/v1/product-images/${filename}`;

  // Write new file to disk
  fs.writeFileSync(filePath, buffer);

  let resultImage: any = null;
  let oldImagePathToDelete: string | null = null;

  try {
    if (replaceImageId) {
      // Find existing image to replace
      const targetOld = existingImages.find((img: any) => img.id === replaceImageId);
      if (targetOld) {
        const oldFilename = path.basename(targetOld.imageUrl);
        oldImagePathToDelete = path.join(ITEM_IMAGE_DIR, oldFilename);

        const [updated] = await db
          .update(schema.itemImages)
          .set({
            storagePath,
            imageUrl,
            label: label || targetOld.label,
            isPrimary: isPrimary ?? targetOld.isPrimary,
            updatedAt: new Date()
          })
          .where(and(eq(schema.itemImages.id, replaceImageId), eq(schema.itemImages.shopId, shopId)))
          .returning();

        resultImage = updated;
      }
    }

    if (!resultImage) {
      const shouldBePrimary = isPrimary || existingImages.length === 0;

      if (shouldBePrimary && existingImages.length > 0) {
        // Demote previous primary images
        await db
          .update(schema.itemImages)
          .set({ isPrimary: false, updatedAt: new Date() })
          .where(and(eq(schema.itemImages.shopId, shopId), eq(schema.itemImages.itemId, itemId)));
      }

      const [inserted] = await db
        .insert(schema.itemImages)
        .values({
          shopId,
          itemId,
          storagePath,
          imageUrl,
          isPrimary: shouldBePrimary,
          label: label || 'Main',
          sortOrder: existingImages.length
        })
        .returning();

      resultImage = inserted;
    }

    // Sync primary image URL to jewellery_items table for fast catalog queries
    if (resultImage.isPrimary) {
      // Set all other images for this item to non-primary
      await db
        .update(schema.itemImages)
        .set({ isPrimary: false, updatedAt: new Date() })
        .where(
          and(
            eq(schema.itemImages.shopId, shopId),
            eq(schema.itemImages.itemId, itemId),
            sql`${schema.itemImages.id} != ${resultImage.id}`
          )
        );

      await db
        .update(schema.jewelleryItems)
        .set({ imageUrl, updatedAt: new Date() })
        .where(and(eq(schema.jewelleryItems.id, itemId), eq(schema.jewelleryItems.shopId, shopId)));
    }

    // Safely unlink old image file now that DB update succeeded
    if (oldImagePathToDelete && fs.existsSync(oldImagePathToDelete)) {
      try {
        fs.unlinkSync(oldImagePathToDelete);
      } catch {
        // Ignore unlink error
      }
    }

    // Audit Log Entry
    const action = replaceImageId ? 'ITEM_IMAGE_REPLACED' : 'ITEM_IMAGE_ADDED';
    await db.insert(schema.auditLogs).values({
      shopId,
      actorId: user.id,
      actorName: user.name,
      actorRole: user.role,
      action,
      entityName: 'JewelleryItem',
      entityId: itemId,
      stateDiff: {
        imageId: resultImage.id,
        imageUrl: resultImage.imageUrl,
        label: resultImage.label,
        isPrimary: resultImage.isPrimary
      },
      ipAddress: ipAddress || '127.0.0.1'
    }).catch(() => {});

    return {
      id: resultImage.id,
      shopId: resultImage.shopId,
      itemId: resultImage.itemId,
      storagePath: resultImage.storagePath,
      imageUrl: resultImage.imageUrl,
      isPrimary: resultImage.isPrimary,
      label: resultImage.label,
      sortOrder: resultImage.sortOrder,
      createdAt: new Date(resultImage.createdAt).toISOString(),
      updatedAt: resultImage.updatedAt ? new Date(resultImage.updatedAt).toISOString() : undefined
    };
  } catch (err: any) {
    // If DB insert/update fails, clean up the newly written file to avoid orphans
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch {}
    }
    throw err;
  }
}

export async function removeItemImage(
  shopId: string,
  itemId: string,
  imageId: string,
  user: { id: string; name: string; role: string },
  ipAddress?: string
): Promise<boolean> {
  const { db } = await getDatabase();

  const imgRows = await db
    .select()
    .from(schema.itemImages)
    .where(
      and(
        eq(schema.itemImages.id, imageId),
        eq(schema.itemImages.itemId, itemId),
        eq(schema.itemImages.shopId, shopId)
      )
    )
    .limit(1);

  if (imgRows.length === 0) {
    throw new Error('Image not found or does not belong to the showroom item.');
  }

  const target = imgRows[0];
  const filename = path.basename(target.imageUrl);
  const filePath = path.join(ITEM_IMAGE_DIR, filename);

  // Delete DB record first
  await db
    .delete(schema.itemImages)
    .where(and(eq(schema.itemImages.id, imageId), eq(schema.itemImages.shopId, shopId)));

  // If deleted image was primary, promote next remaining image or set null
  if (target.isPrimary) {
    const remaining = await db
      .select()
      .from(schema.itemImages)
      .where(and(eq(schema.itemImages.itemId, itemId), eq(schema.itemImages.shopId, shopId)))
      .orderBy(desc(schema.itemImages.createdAt))
      .limit(1);

    if (remaining.length > 0) {
      await db
        .update(schema.itemImages)
        .set({ isPrimary: true, updatedAt: new Date() })
        .where(eq(schema.itemImages.id, remaining[0].id));

      await db
        .update(schema.jewelleryItems)
        .set({ imageUrl: remaining[0].imageUrl, updatedAt: new Date() })
        .where(and(eq(schema.jewelleryItems.id, itemId), eq(schema.jewelleryItems.shopId, shopId)));
    } else {
      await db
        .update(schema.jewelleryItems)
        .set({ imageUrl: null, updatedAt: new Date() })
        .where(and(eq(schema.jewelleryItems.id, itemId), eq(schema.jewelleryItems.shopId, shopId)));
    }
  }

  // Unlink file from disk
  if (fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
    } catch {}
  }

  // Audit Log Entry
  await db.insert(schema.auditLogs).values({
    shopId,
    actorId: user.id,
    actorName: user.name,
    actorRole: user.role,
    action: 'ITEM_IMAGE_REMOVED',
    entityName: 'JewelleryItem',
    entityId: itemId,
    stateDiff: {
      imageId: target.id,
      imageUrl: target.imageUrl,
      label: target.label
    },
    ipAddress: ipAddress || '127.0.0.1'
  }).catch(() => {});

  return true;
}

export async function getItemImages(shopId: string, itemId: string): Promise<ItemImage[]> {
  const { db } = await getDatabase();

  const rows = await db
    .select()
    .from(schema.itemImages)
    .where(and(eq(schema.itemImages.shopId, shopId), eq(schema.itemImages.itemId, itemId)))
    .orderBy(desc(schema.itemImages.isPrimary), schema.itemImages.sortOrder);

  return rows.map((r: any) => ({
    id: r.id,
    shopId: r.shopId,
    itemId: r.itemId,
    storagePath: r.storagePath,
    imageUrl: r.imageUrl,
    isPrimary: r.isPrimary,
    label: r.label,
    sortOrder: r.sortOrder,
    createdAt: new Date(r.createdAt).toISOString(),
    updatedAt: r.updatedAt ? new Date(r.updatedAt).toISOString() : undefined
  }));
}
