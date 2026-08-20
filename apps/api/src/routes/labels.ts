import { FastifyInstance, FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import {
  getLabelTemplate,
  updateLabelTemplate,
  resetLabelTemplate,
  getTestLabelData
} from '../services/labels.service.js';
import { authenticate } from '../middleware/auth.js';
import { ApiResponse } from '@jewellery-pos/shared';
import { updateLabelTemplateSchema } from '@jewellery-pos/validation';

export const labelsRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // 1. Get Active Label Template for Shop
  app.get('/labels/template', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const shopId = request.user!.shopId;
    const template = await getLabelTemplate(shopId);

    const response: ApiResponse = {
      success: true,
      data: template
    };
    return reply.send(response);
  });

  // 2. Update / Customize Label Template (Owner ADMIN only)
  app.put(
    '/labels/template',
    { preHandler: [authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = request.user!;
      const shopId = user.shopId;

      // Role check: Only Owner / Admin can customize
      if (user.role !== 'ADMIN') {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Forbidden: Only the Shop Owner can customize label templates.'
          }
        };
        return reply.status(403).send(response);
      }

      const parseResult = updateLabelTemplateSchema.safeParse(request.body);
      if (!parseResult.success) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: parseResult.error.errors[0]?.message || 'Invalid label template configuration'
          }
        };
        return reply.status(400).send(response);
      }

      try {
        const updated = await updateLabelTemplate(
          shopId,
          parseResult.data as any,
          user.id,
          user.name,
          user.role
        );

        const response: ApiResponse = {
          success: true,
          data: updated
        };
        return reply.send(response);
      } catch (err: any) {
        const isForbidden = err.message?.includes('Forbidden');
        const response: ApiResponse = {
          success: false,
          error: {
            code: isForbidden ? 'FORBIDDEN' : 'UPDATE_FAILED',
            message: err.message || 'Failed to update label template'
          }
        };
        return reply.status(isForbidden ? 403 : 400).send(response);
      }
    }
  );

  // 3. Reset Label Template to Factory Defaults (Owner ADMIN only)
  app.post(
    '/labels/template/reset',
    { preHandler: [authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = request.user!;
      const shopId = user.shopId;

      if (user.role !== 'ADMIN') {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Forbidden: Only the Shop Owner can reset label templates.'
          }
        };
        return reply.status(403).send(response);
      }

      try {
        const reset = await resetLabelTemplate(shopId, user.id, user.name, user.role);
        const response: ApiResponse = {
          success: true,
          data: reset
        };
        return reply.send(response);
      } catch (err: any) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'RESET_FAILED',
            message: err.message || 'Failed to reset label template'
          }
        };
        return reply.status(400).send(response);
      }
    }
  );

  // 4. Get Dummy Test Label Data for Live Preview
  app.get('/labels/test-data', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const shopId = request.user!.shopId;
    const testData = await getTestLabelData(shopId);

    const response: ApiResponse = {
      success: true,
      data: testData
    };
    return reply.send(response);
  });
};
