import { FastifyInstance, FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { listItems, getItemByIdOrCode, createItem, updateItem } from '../services/items.service.js';
import { uploadItemImage, removeItemImage, getItemImages, ITEM_IMAGE_DIR, ensureItemImageDir } from '../services/item_images.service.js';
import { authenticate } from '../middleware/auth.js';
import { ApiResponse } from '@jewellery-pos/shared';
import { createJewelleryItemSchema, uploadItemImageSchema } from '@jewellery-pos/validation';
import fs from 'fs';
import path from 'path';

export const itemsRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  ensureItemImageDir();

  // 1. Serving Endpoint for Product Images
  app.get<{ Params: { filename: string } }>('/assets/items/:filename', async (request, reply) => {
    const { filename } = request.params;
    if (!filename || !/^[\w\-]+\.(png|jpg|jpeg|webp)$/i.test(filename)) {
      return reply.status(400).send({
        success: false,
        error: { code: 'INVALID_FILENAME', message: 'Invalid asset filename format' }
      });
    }

    const resolvedPath = path.resolve(ITEM_IMAGE_DIR, filename);
    const normalizedDir = path.normalize(ITEM_IMAGE_DIR).toLowerCase();
    const normalizedPath = path.normalize(resolvedPath).toLowerCase();

    console.log('INSIDE SERVE HANDLER:', { filename, resolvedPath, exists: fs.existsSync(resolvedPath), normalizedDir, normalizedPath });

    if (!normalizedPath.startsWith(normalizedDir) || !fs.existsSync(resolvedPath)) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Product image asset not found' }
      });
    }

    const ext = path.extname(filename).toLowerCase();
    const contentTypeMap: Record<string, string> = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.webp': 'image/webp'
    };

    const contentType = contentTypeMap[ext] || 'application/octet-stream';
    reply.header('Cache-Control', 'private, max-age=86400');
    const stream = fs.createReadStream(resolvedPath);
    return reply.type(contentType).send(stream);
  });

  // 2. List Canonical Jewellery Inventory Items
  app.get<{ Querystring: { status?: string; search?: string } }>(
    '/items',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const shopId = request.user?.shopId || request.shop?.id || '00000000-0000-0000-0000-000000000001';
      const items = await listItems(shopId, request.query.status, request.query.search);

      const response: ApiResponse = {
        success: true,
        data: items
      };
      return reply.send(response);
    }
  );

  // 3. Stock Inwarding / Create New Jewellery Item (IMAGE NOT REQUIRED)
  app.post(
    '/items',
    { preHandler: [authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parseResult = createJewelleryItemSchema.safeParse(request.body);
      if (!parseResult.success) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: parseResult.error.errors[0]?.message || 'Invalid item parameters'
          }
        };
        return reply.status(400).send(response);
      }

      const shopId = request.user!.shopId;
      try {
        const item = await createItem(
          shopId,
          {
            itemCode: parseResult.data.itemCode,
            category: parseResult.data.category,
            designTitle: parseResult.data.designTitle,
            metal: parseResult.data.metal as any,
            purity: parseResult.data.purity,
            grossWeight: parseResult.data.grossWeight.toString(),
            stoneWeight: parseResult.data.stoneWeight?.toString() || '0.000',
            huid: parseResult.data.huid || undefined,
            hallmarkVerified: parseResult.data.hallmarkVerified,
            makingChargeType: parseResult.data.makingChargeType as any,
            makingChargeValue: parseResult.data.makingChargeValue?.toString(),
            wastagePct: parseResult.data.wastagePct?.toString(),
            stoneValue: parseResult.data.stoneValue?.toString(),
            notes: parseResult.data.notes || undefined
          },
          request.user!.id
        );

        const response: ApiResponse = {
          success: true,
          data: item
        };
        return reply.status(201).send(response);
      } catch (err: any) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'INWARDING_ERROR',
            message: err.message || 'Failed to inward item'
          }
        };
        return reply.status(400).send(response);
      }
    }
  );

  // 4. Upload / Add Image for an Item
  app.post<{ Params: { id: string } }>(
    '/items/:id/images',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const shopId = request.user!.shopId;
      const itemId = request.params.id;

      const parseResult = uploadItemImageSchema.safeParse(request.body);
      if (!parseResult.success) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: parseResult.error.errors[0]?.message || 'Invalid image payload'
          }
        };
        return reply.status(400).send(response);
      }

      const body = request.body as any;

      try {
        const itemImage = await uploadItemImage({
          shopId,
          itemId,
          imageBase64: parseResult.data.imageBase64,
          label: parseResult.data.label,
          isPrimary: parseResult.data.isPrimary,
          replaceImageId: body.replaceImageId,
          user: {
            id: request.user!.id,
            name: request.user!.name,
            role: request.user!.role
          },
          ipAddress: request.ip
        });

        const response: ApiResponse = {
          success: true,
          data: itemImage
        };
        return reply.status(201).send(response);
      } catch (err: any) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'IMAGE_UPLOAD_ERROR',
            message: err.message || 'Failed to upload item image'
          }
        };
        return reply.status(400).send(response);
      }
    }
  );

  // 5. Get All Images for an Item
  app.get<{ Params: { id: string } }>(
    '/items/:id/images',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const shopId = request.user!.shopId;
      const itemId = request.params.id;

      try {
        const images = await getItemImages(shopId, itemId);
        const response: ApiResponse = {
          success: true,
          data: images
        };
        return reply.send(response);
      } catch (err: any) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'IMAGE_FETCH_ERROR',
            message: err.message || 'Failed to fetch item images'
          }
        };
        return reply.status(400).send(response);
      }
    }
  );

  // 6. Delete / Remove an Item Image
  app.delete<{ Params: { id: string; imageId: string } }>(
    '/items/:id/images/:imageId',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const shopId = request.user!.shopId;
      const { id: itemId, imageId } = request.params;

      try {
        await removeItemImage(
          shopId,
          itemId,
          imageId,
          {
            id: request.user!.id,
            name: request.user!.name,
            role: request.user!.role
          },
          request.ip
        );

        const response: ApiResponse = {
          success: true,
          data: { removed: true, imageId }
        };
        return reply.send(response);
      } catch (err: any) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'IMAGE_DELETE_ERROR',
            message: err.message || 'Failed to remove image'
          }
        };
        return reply.status(400).send(response);
      }
    }
  );

  // 7. Get Single Item by UUID, Serial Item Code, or BIS HUID
  app.get<{ Params: { id: string } }>(
    '/items/:id',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const shopId = request.user?.shopId || request.shop?.id || '00000000-0000-0000-0000-000000000001';
      const item = await getItemByIdOrCode(shopId, request.params.id);

      if (!item) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: `Jewellery item '${request.params.id}' not found in showroom inventory`
          }
        };
        return reply.status(404).send(response);
      }

      const response: ApiResponse = {
        success: true,
        data: item
      };
      return reply.send(response);
    }
  );

  // 8. Update Existing Item
  app.put(
    '/items/:id',
    { preHandler: [authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const params = request.params as { id: string };
      const body = (request.body || {}) as any;
      const shopId = request.user!.shopId;
      try {
        const updated = await updateItem(shopId, params.id, body);
        const response: ApiResponse = {
          success: true,
          data: updated
        };
        return reply.send(response);
      } catch (err: any) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'UPDATE_ERROR',
            message: err.message || 'Failed to update item'
          }
        };
        return reply.status(400).send(response);
      }
    }
  );
};
