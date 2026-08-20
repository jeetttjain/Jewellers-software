import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticate, requireRole } from '../middleware/auth.js';
import { createRateLimiter } from '../middleware/rateLimit.js';
import { BackupService } from '../services/backup.service.js';
import { getDatabase } from '../db/connection.js';
import * as schema from '../db/schema/index.js';
import { eq } from 'drizzle-orm';
import { verifyPin } from '../services/crypto.js';
import { ApiResponse, BackupStatusResponse, RestoreInspectionResponse } from '@jewellery-pos/shared';

const backupRateLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000,
  maxRequests: 10,
  maxFailedAttempts: 5,
  lockoutMs: 5 * 60 * 1000,
  keyPrefix: 'backup_ops'
});

export async function backupRoutes(app: FastifyInstance) {
  // 1. Get Backup Status
  app.get('/backup/status', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const shopId = request.user!.shopId;
    const status = await BackupService.getStatus(shopId);

    const response: ApiResponse<BackupStatusResponse> = {
      success: true,
      data: status
    };
    return reply.send(response);
  });

  // 2. Export / Create Encrypted .shopbackup File
  app.post('/backup/export', { preHandler: [authenticate, requireRole(['ADMIN']), backupRateLimiter] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const shopId = request.user!.shopId;
    const body = (request.body || {}) as { backupType?: 'FULL' | 'INCREMENTAL'; pin?: string };

    // Verify Owner PIN if provided
    if (body.pin) {
      const { db } = await getDatabase();
      const shopRows = await db.select().from(schema.shops).where(eq(schema.shops.id, shopId)).limit(1);
      const ownerPinHash = shopRows[0]?.ownerPinHash;
      if (ownerPinHash) {
        const pinValid = await verifyPin(body.pin, ownerPinHash);
        if (!pinValid) {
          const res: ApiResponse = {
            success: false,
            error: { code: 'INVALID_OWNER_PIN', message: 'Incorrect Owner PIN for backup export.' }
          };
          return reply.status(401).send(res);
        }
      }
    }

    const backupType = body.backupType || 'FULL';
    const secretKeyMaterial = 'JEWELLERY_POS_SECURE_BACKUP_KEY_2026';

    const { backupBuffer, filename } = await BackupService.createBackup(shopId, backupType, secretKeyMaterial);

    reply.header('Content-Type', 'application/octet-stream');
    reply.header('Content-Disposition', `attachment; filename="${filename}"`);
    reply.header('X-Backup-Filename', filename);
    reply.header('X-Backup-Size-Bytes', backupBuffer.length.toString());

    return reply.send(backupBuffer);
  });

  // 3. Inspect Uploaded .shopbackup File
  app.post('/backup/inspect', { preHandler: [authenticate, requireRole(['ADMIN']), backupRateLimiter] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const shopId = request.user!.shopId;
    const body = (request.body || {}) as { fileBase64?: string; pin?: string };

    if (!body.fileBase64) {
      const res: ApiResponse = {
        success: false,
        error: { code: 'MISSING_FILE', message: 'No backup file payload provided for inspection.' }
      };
      return reply.status(400).send(res);
    }

    const fileBuffer = Buffer.from(body.fileBase64, 'base64');
    const secretKeyMaterial = process.env['BACKUP_ENCRYPTION_KEY'] || 'JEWELLERY_POS_SECURE_BACKUP_KEY_2026';

    try {
      const inspection = BackupService.inspectBackupFile(fileBuffer, secretKeyMaterial, shopId);
      const res: ApiResponse<RestoreInspectionResponse> = {
        success: true,
        data: inspection
      };
      return reply.send(res);
    } catch (err: any) {
      const res: ApiResponse = {
        success: false,
        error: { code: 'INVALID_BACKUP_FILE', message: err.message || 'Backup file inspection failed.' }
      };
      return reply.status(400).send(res);
    }
  });

  // 4. Execute Restore of .shopbackup File
  app.post('/backup/restore', { preHandler: [authenticate, requireRole(['ADMIN']), backupRateLimiter] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const shopId = request.user!.shopId;
    const userId = request.user!.id;
    const body = (request.body || {}) as { fileBase64?: string; pin?: string };

    if (!body.fileBase64) {
      const res: ApiResponse = {
        success: false,
        error: { code: 'MISSING_FILE', message: 'No backup file payload provided for restoration.' }
      };
      return reply.status(400).send(res);
    }

    // Require Owner PIN verification
    const { db } = await getDatabase();
    const shopRows = await db.select().from(schema.shops).where(eq(schema.shops.id, shopId)).limit(1);
    const ownerPinHash = shopRows[0]?.ownerPinHash;

    if (ownerPinHash) {
      if (!body.pin) {
        const res: ApiResponse = {
          success: false,
          error: { code: 'PIN_REQUIRED', message: 'Owner PIN is required to authorize backup restoration.' }
        };
        return reply.status(401).send(res);
      }

      const pinValid = await verifyPin(body.pin, ownerPinHash);
      if (!pinValid) {
        const res: ApiResponse = {
          success: false,
          error: { code: 'INVALID_OWNER_PIN', message: 'Incorrect Owner PIN. Restore authorization denied.' }
        };
        return reply.status(401).send(res);
      }
    }

    const fileBuffer = Buffer.from(body.fileBase64, 'base64');
    const secretKeyMaterial = 'JEWELLERY_POS_SECURE_BACKUP_KEY_2026';

    try {
      const result = await BackupService.restoreBackup(shopId, fileBuffer, userId, secretKeyMaterial);
      const res: ApiResponse = {
        success: true,
        data: result
      };
      return reply.send(res);
    } catch (err: any) {
      const res: ApiResponse = {
        success: false,
        error: { code: 'RESTORE_FAILED', message: err.message || 'Database restoration failed.' }
      };
      return reply.status(500).send(res);
    }
  });
}
