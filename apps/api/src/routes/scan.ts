import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { lookupItemWithQuote } from '../services/scan.service.js';
import { authenticate } from '../middleware/auth.js';
import { ApiResponse } from '@jewellery-pos/shared';

export const scanRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.get<{ Querystring: { code?: string } }>(
    '/scan/lookup',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const code = request.query.code;
      if (!code || !code.trim()) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'SCAN_CODE_REQUIRED',
            message: 'A barcode, QR code string, or item serial code is required.'
          }
        };
        return reply.status(400).send(response);
      }

      const shopId = request.user!.shopId;

      try {
        const quote = await lookupItemWithQuote(shopId, code.trim());
        const response: ApiResponse = {
          success: true,
          data: quote
        };
        return reply.send(response);
      } catch (err: any) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'ITEM_NOT_FOUND',
            message: err.message || `No item found matching scanned code '${code}'`
          }
        };
        return reply.status(404).send(response);
      }
    }
  );
};
