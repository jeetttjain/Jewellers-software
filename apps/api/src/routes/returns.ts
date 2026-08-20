import { FastifyInstance, FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { listReturns, createReturnTransaction } from '../services/returns.service.js';
import { authenticate } from '../middleware/auth.js';
import { ApiResponse } from '@jewellery-pos/shared';
import { createReturnSchema } from '@jewellery-pos/validation';

export const returnsRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // 1. List Returns
  app.get('/returns', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const shopId = request.user!.shopId;
    const list = await listReturns(shopId);

    const response: ApiResponse = {
      success: true,
      data: list
    };
    return reply.send(response);
  });

  // 2. Process Sales Return with Supervisor PIN Authorization
  app.post(
    '/returns',
    { preHandler: [authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parseResult = createReturnSchema.safeParse(request.body);
      if (!parseResult.success) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: parseResult.error.errors[0]?.message || 'Invalid return parameters'
          }
        };
        return reply.status(400).send(response);
      }

      const shopId = request.user!.shopId;
      try {
        const result = await createReturnTransaction(
          shopId,
          {
            originalInvoiceNumber: parseResult.data.originalInvoiceNumber,
            itemCode: parseResult.data.itemCode,
            returnReason: parseResult.data.returnReason,
            refundAmount: parseResult.data.refundAmount.toString(),
            deductionAmount: parseResult.data.deductionAmount?.toString() || '0.00',
            restockDestination: parseResult.data.restockDestination as any,
            supervisorPin: parseResult.data.supervisorPin
          },
          request.user!.id,
          request.user!.name
        );

        const response: ApiResponse = {
          success: true,
          data: result
        };
        return reply.status(201).send(response);
      } catch (err: any) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'RETURN_FAILED',
            message: err.message || 'Failed to process return transaction'
          }
        };
        return reply.status(400).send(response);
      }
    }
  );
};
