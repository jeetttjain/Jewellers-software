import { FastifyInstance, FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { getDatabase } from '../db/connection.js';
import * as schema from '../db/schema/index.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { createRateLimiter } from '../middleware/rateLimit.js';
import { hashPin, verifyPin } from '../services/crypto.js';
import { ApiResponse } from '@jewellery-pos/shared';
import { ownerPinSchema, invoiceTemplateSchema } from '@jewellery-pos/validation';
import { eq } from 'drizzle-orm';
import { Decimal } from 'decimal.js';
import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

export const DEFAULT_INVOICE_TEMPLATE = {
  paperSize: 'A4',
  logoVisible: true,
  shopNameVisible: true,
  addressVisible: true,
  gstinVisible: true,
  phoneVisible: true,
  emailVisible: true,
  customerNameVisible: true,
  customerMobileVisible: true,
  customerAddressVisible: true,
  customerPanVisible: true,
  customerGstinVisible: true,
  itemHuidVisible: true,
  itemBarcodeVisible: true,
  itemGrossWeightVisible: true,
  itemStoneWeightVisible: true,
  itemNetWeightVisible: true,
  itemMakingChargesVisible: true,
  itemWastageVisible: true,
  itemStoneValueVisible: true,
  itemDiscountVisible: true,
  cgstSgstBreakdownVisible: true,
  oldGoldDeductionVisible: true,
  termsVisible: true,
  termsText: '1. Goods once sold will be exchanged as per store policy.\n2. All disputes subject to local jurisdiction.',
  footerText: 'Thank you for shopping with us!'
};

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const LOGO_DIR = path.resolve(currentDir, '../../uploads/logos');

function ensureLogoDir() {
  if (!fs.existsSync(LOGO_DIR)) {
    fs.mkdirSync(LOGO_DIR, { recursive: true });
  }
}

function unlinkOldLogo(logoUrl?: string | null) {
  if (!logoUrl) return;
  try {
    const filename = path.basename(logoUrl);
    const filePath = path.join(LOGO_DIR, filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch {
    // Ignore unlink errors
  }
}

/**
 * Validates real binary magic bytes for uploaded image buffer.
 */
function isValidImageSignature(buffer: Buffer, mimeType: string): boolean {
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

const ownerPinVerifyRateLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000,
  maxRequests: 10,
  maxFailedAttempts: 5,
  lockoutMs: 5 * 60 * 1000,
  keyPrefix: 'owner_pin_verify'
});

const ownerPinSetupRateLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000,
  maxRequests: 10,
  maxFailedAttempts: 5,
  lockoutMs: 5 * 60 * 1000,
  keyPrefix: 'owner_pin_setup'
});

export const settingsRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  ensureLogoDir();

  // 1. Get Showroom Settings
  app.get('/settings', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const shopId = request.user!.shopId;
    const { db } = await getDatabase();

    const shopRows = await db.select().from(schema.shops).where(eq(schema.shops.id, shopId)).limit(1);

    if (shopRows.length === 0) {
      const response: ApiResponse = {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Shop profile not found' }
      };
      return reply.status(404).send(response);
    }

    const shop = shopRows[0];
    const { ownerPinHash, ...safeShop } = shop;

    const response: ApiResponse = {
      success: true,
      data: {
        ...safeShop,
        ownerPinSet: !!ownerPinHash,
        invoiceTemplate: shop.invoiceTemplate || DEFAULT_INVOICE_TEMPLATE
      }
    };
    return reply.send(response);
  });

  // 2. Update Showroom Settings (Owner ADMIN only)
  app.put(
    '/settings',
    { preHandler: [authenticate, requireRole(['ADMIN'])] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const shopId = request.user!.shopId;
      const { db } = await getDatabase();
      const body = (request.body || {}) as any;

      const payload: any = { updatedAt: new Date() };
      if (body.name) payload.name = body.name.trim();
      if (body.address) payload.address = body.address.trim();
      if (body.phone) payload.phone = body.phone.trim();
      if (body.email) payload.email = body.email.trim();
      if (body.gstin) payload.gstin = body.gstin.trim().toUpperCase();
      if (body.defaultTaxPercent) payload.defaultTaxPercent = new Decimal(body.defaultTaxPercent).toFixed(2);
      if (body.invoicePrefix) payload.invoicePrefix = body.invoicePrefix.trim();
      if (body.termsAndConditions !== undefined) payload.termsAndConditions = body.termsAndConditions;
      if (body.logoUrl !== undefined) payload.logoUrl = body.logoUrl;

      const [updated] = await db
        .update(schema.shops)
        .set(payload)
        .where(eq(schema.shops.id, shopId))
        .returning();

      // Audit entry for SHOP_PROFILE_UPDATED
      await db.insert(schema.auditLogs).values({
        shopId,
        actorId: request.user!.id,
        actorName: request.user!.name,
        actorRole: request.user!.role,
        action: 'SHOP_PROFILE_UPDATED',
        entityName: 'Shop',
        entityId: shopId,
        stateDiff: payload,
        ipAddress: request.ip
      }).catch(() => {});

      const { ownerPinHash, ...safeUpdated } = updated;
      const response: ApiResponse = {
        success: true,
        data: {
          ...safeUpdated,
          ownerPinSet: !!ownerPinHash
        }
      };
      return reply.send(response);
    }
  );

  // 3. Setup / Change Owner 6-Digit PIN (Owner ADMIN only)
  app.post(
    '/settings/owner-pin/setup',
    { preHandler: [authenticate, requireRole(['ADMIN']), ownerPinSetupRateLimiter] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const shopId = request.user!.shopId;
      const body = (request.body || {}) as { pin?: string };

      const parseResult = ownerPinSchema.safeParse(body.pin);
      if (!parseResult.success) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: parseResult.error.errors[0]?.message || 'Owner PIN must consist of exactly 6 numeric digits'
          }
        };
        return reply.status(400).send(response);
      }

      const pinHash = await hashPin(parseResult.data);
      const { db } = await getDatabase();

      await db
        .update(schema.shops)
        .set({ ownerPinHash: pinHash, updatedAt: new Date() })
        .where(eq(schema.shops.id, shopId));

      await db.insert(schema.auditLogs).values({
        shopId,
        actorId: request.user!.id,
        actorName: request.user!.name,
        actorRole: request.user!.role,
        action: 'OWNER_PIN_SET',
        entityName: 'Shop',
        entityId: shopId,
        stateDiff: { ownerPinSet: true },
        ipAddress: request.ip
      }).catch(() => {});

      const response: ApiResponse = {
        success: true,
        data: { message: 'Owner 6-digit PIN successfully set' }
      };
      return reply.send(response);
    }
  );

  // 4. Verify Owner 6-Digit PIN
  app.post(
    '/settings/owner-pin/verify',
    { preHandler: [authenticate, ownerPinVerifyRateLimiter] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const shopId = request.user!.shopId;
      const body = (request.body || {}) as { pin?: string };

      if (!body.pin || typeof body.pin !== 'string' || !/^\d{6}$/.test(body.pin)) {
        const response: ApiResponse = {
          success: false,
          error: { code: 'INVALID_PIN', message: 'Owner PIN must be 6 numeric digits' }
        };
        return reply.status(400).send(response);
      }

      const { db } = await getDatabase();
      const shopRows = await db.select().from(schema.shops).where(eq(schema.shops.id, shopId)).limit(1);

      if (shopRows.length === 0 || !shopRows[0].ownerPinHash) {
        const response: ApiResponse = {
          success: false,
          error: { code: 'PIN_NOT_SET', message: 'Owner PIN has not been initialized for this shop' }
        };
        return reply.status(400).send(response);
      }

      const isValid = await verifyPin(body.pin, shopRows[0].ownerPinHash);
      if (!isValid) {
        const response: ApiResponse = {
          success: false,
          error: { code: 'INVALID_PIN', message: 'Incorrect Owner PIN' }
        };
        return reply.status(401).send(response);
      }

      await db.insert(schema.auditLogs).values({
        shopId,
        actorId: request.user!.id,
        actorName: request.user!.name,
        actorRole: request.user!.role,
        action: 'OWNER_MODE_AUTHENTICATED',
        entityName: 'Shop',
        entityId: shopId,
        ipAddress: request.ip
      }).catch(() => {});

      const response: ApiResponse = {
        success: true,
        data: { verified: true }
      };
      return reply.send(response);
    }
  );

  // 5. Get Invoice Template Configuration
  app.get('/settings/invoice-template', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const shopId = request.user!.shopId;
    const { db } = await getDatabase();

    const shopRows = await db.select().from(schema.shops).where(eq(schema.shops.id, shopId)).limit(1);
    const template = shopRows[0]?.invoiceTemplate || DEFAULT_INVOICE_TEMPLATE;

    const response: ApiResponse = {
      success: true,
      data: template
    };
    return reply.send(response);
  });

  // 6. Update Invoice Template Configuration (Owner ADMIN only)
  app.put(
    '/settings/invoice-template',
    { preHandler: [authenticate, requireRole(['ADMIN'])] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const shopId = request.user!.shopId;
      const parseResult = invoiceTemplateSchema.safeParse(request.body);

      if (!parseResult.success) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: parseResult.error.errors[0]?.message || 'Invalid invoice template configuration'
          }
        };
        return reply.status(400).send(response);
      }

      const { db } = await getDatabase();
      const [updatedShop] = await db
        .update(schema.shops)
        .set({ invoiceTemplate: parseResult.data, updatedAt: new Date() })
        .where(eq(schema.shops.id, shopId))
        .returning();

      await db.insert(schema.auditLogs).values({
        shopId,
        actorId: request.user!.id,
        actorName: request.user!.name,
        actorRole: request.user!.role,
        action: 'BILL_TEMPLATE_UPDATED',
        entityName: 'Shop',
        entityId: shopId,
        stateDiff: parseResult.data,
        ipAddress: request.ip
      }).catch(() => {});

      const response: ApiResponse = {
        success: true,
        data: updatedShop.invoiceTemplate
      };
      return reply.send(response);
    }
  );

  // 7. Upload Shop Logo (Owner ADMIN only)
  app.post(
    '/settings/logo',
    { preHandler: [authenticate, requireRole(['ADMIN'])] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const shopId = request.user!.shopId;
      const body = (request.body || {}) as { imageBase64?: string };
      const imageBase64 = body.imageBase64;

      if (!imageBase64 || typeof imageBase64 !== 'string') {
        const response: ApiResponse = {
          success: false,
          error: { code: 'INVALID_IMAGE', message: 'imageBase64 field is required' }
        };
        return reply.status(400).send(response);
      }

      // Check format (PNG, JPG, WEBP)
      const match = imageBase64.match(/^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/);
      if (!match) {
        const response: ApiResponse = {
          success: false,
          error: { code: 'INVALID_FORMAT', message: 'Only PNG, JPEG, and WEBP image formats are permitted' }
        };
        return reply.status(400).send(response);
      }

      const mimeType = match[1] || '';
      const base64Data = match[2] || '';
      const buffer = Buffer.from(base64Data, 'base64');

      // Max 2MB limit
      if (buffer.length > 2 * 1024 * 1024) {
        const response: ApiResponse = {
          success: false,
          error: { code: 'FILE_TOO_LARGE', message: 'Logo file size must not exceed 2MB' }
        };
        return reply.status(400).send(response);
      }

      // Validate real binary magic bytes signature
      if (!isValidImageSignature(buffer, mimeType)) {
        const response: ApiResponse = {
          success: false,
          error: { code: 'INVALID_IMAGE_SIGNATURE', message: 'File contents do not match valid PNG, JPEG, or WEBP image binary header signature.' }
        };
        return reply.status(400).send(response);
      }

      const ext = mimeType === 'jpeg' ? 'jpg' : mimeType;
      const filename = `logo_${shopId}_${randomUUID()}.${ext}`;
      const filePath = path.join(LOGO_DIR, filename);

      const { db } = await getDatabase();

      // Fetch current shop to unlink old logo file
      const currentShopRows = await db.select().from(schema.shops).where(eq(schema.shops.id, shopId)).limit(1);
      if (currentShopRows.length > 0 && currentShopRows[0]?.logoUrl) {
        unlinkOldLogo(currentShopRows[0]?.logoUrl || null);
      }

      // Write new logo file to disk
      ensureLogoDir();
      fs.writeFileSync(filePath, buffer);

      const logoUrl = `/api/v1/uploads/logos/${filename}`;

      const [updatedShop] = await db
        .update(schema.shops)
        .set({ logoUrl, updatedAt: new Date() })
        .where(eq(schema.shops.id, shopId))
        .returning();

      const action = currentShopRows[0]?.logoUrl ? 'SHOP_LOGO_CHANGED' : 'SHOP_LOGO_UPLOADED';

      // Audit Log Entry
      await db.insert(schema.auditLogs).values({
        shopId,
        actorId: request.user!.id,
        actorName: request.user!.name,
        actorRole: request.user!.role,
        action,
        entityName: 'Shop',
        entityId: shopId,
        stateDiff: { logoUrl, filename },
        ipAddress: request.ip
      }).catch(() => {});

      const { ownerPinHash, ...safeShop } = updatedShop;
      const response: ApiResponse = {
        success: true,
        data: {
          ...safeShop,
          ownerPinSet: !!ownerPinHash
        }
      };
      return reply.send(response);
    }
  );

  // 8. Remove Shop Logo (Owner ADMIN only)
  app.delete(
    '/settings/logo',
    { preHandler: [authenticate, requireRole(['ADMIN'])] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const shopId = request.user!.shopId;
      const { db } = await getDatabase();

      const currentShopRows = await db.select().from(schema.shops).where(eq(schema.shops.id, shopId)).limit(1);
      if (currentShopRows.length > 0 && currentShopRows[0]?.logoUrl) {
        unlinkOldLogo(currentShopRows[0]?.logoUrl || null);
      }

      const [updatedShop] = await db
        .update(schema.shops)
        .set({ logoUrl: null, updatedAt: new Date() })
        .where(eq(schema.shops.id, shopId))
        .returning();

      // Audit Log Entry
      await db.insert(schema.auditLogs).values({
        shopId,
        actorId: request.user!.id,
        actorName: request.user!.name,
        actorRole: request.user!.role,
        action: 'SHOP_LOGO_REMOVED',
        entityName: 'Shop',
        entityId: shopId,
        stateDiff: { logoUrl: null },
        ipAddress: request.ip
      }).catch(() => {});

      const { ownerPinHash, ...safeShop } = updatedShop;
      const response: ApiResponse = {
        success: true,
        data: {
          ...safeShop,
          ownerPinSet: !!ownerPinHash
        }
      };
      return reply.send(response);
    }
  );

  // 5. Public Static Serving Endpoint for Shop Logos
  app.get('/uploads/logos/:filename', async (request: FastifyRequest<{ Params: { filename: string } }>, reply: FastifyReply) => {
    const { filename } = request.params;
    if (!filename || !/^[a-zA-Z0-9_-]+\.(png|jpg|jpeg|webp)$/i.test(filename)) {
      return reply.status(400).send({ success: false, error: { code: 'INVALID_FILENAME', message: 'Invalid asset filename format' } });
    }

    const resolvedPath = path.resolve(LOGO_DIR, filename);
    if (!resolvedPath.startsWith(LOGO_DIR) || !fs.existsSync(resolvedPath)) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Logo asset not found' } });
    }

    const ext = path.extname(filename).toLowerCase();
    const contentTypeMap: Record<string, string> = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.webp': 'image/webp'
    };

    const contentType = contentTypeMap[ext] || 'application/octet-stream';
    const stream = fs.createReadStream(resolvedPath);
    return reply.type(contentType).send(stream);
  });
};
