import { FastifyInstance, FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { listOldGoldTransactions, createOldGoldAssay } from '../services/oldGold.service.js';
import { authenticate } from '../middleware/auth.js';
import { ApiResponse } from '@jewellery-pos/shared';
import { createOldGoldSchema } from '@jewellery-pos/validation';

export const oldGoldRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // 1. List Old Gold Transactions
  app.get('/old-gold', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const shopId = request.user!.shopId;
    const list = await listOldGoldTransactions(shopId);

    const response: ApiResponse = {
      success: true,
      data: list
    };
    return reply.send(response);
  });

  // 2. Create Old Scrap Gold Melt Assay & Exchange Credit Note
  app.post(
    '/old-gold',
    { preHandler: [authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parseResult = createOldGoldSchema.safeParse(request.body);
      if (!parseResult.success) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: parseResult.error.errors[0]?.message || 'Invalid old gold parameters'
          }
        };
        return reply.status(400).send(response);
      }

      const shopId = request.user!.shopId;
      try {
        const voucher = await createOldGoldAssay(
          shopId,
          {
            customerId: (parseResult.data as any).customerId || undefined,
            customerName: parseResult.data.customerName,
            customerMobile: parseResult.data.customerMobile,
            metal: parseResult.data.metal as any,
            grossWeight: parseResult.data.grossWeight.toString(),
            dustStoneDeduction: parseResult.data.dustStoneDeduction?.toString() || '0.000',
            testedPurityPercent: parseResult.data.testedPurityPercent.toString(),
            buybackRatePerGram: parseResult.data.buybackRatePerGram.toString(),
            settlementType: parseResult.data.settlementType as any,
            notes: parseResult.data.notes || undefined
          },
          request.user!.id,
          request.user!.name
        );

        const response: ApiResponse = {
          success: true,
          data: voucher
        };
        return reply.status(201).send(response);
      } catch (err: any) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'ASSAY_CREATION_FAILED',
            message: err.message || 'Failed to generate old gold voucher'
          }
        };
        return reply.status(400).send(response);
      }
    }
  );
};
