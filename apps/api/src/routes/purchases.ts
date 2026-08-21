import { FastifyInstance, FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import {
  listPurchases,
  getPurchaseById,
  createPurchaseTransaction,
  recordPurchasePayment
} from '../services/purchases.service.js';
import { authenticate } from '../middleware/auth.js';
import { ApiResponse } from '@jewellery-pos/shared';
import {
  createPurchaseSchema,
  recordSupplierPaymentSchema
} from '@jewellery-pos/validation';

export const purchaseRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // 1. List Purchases
  app.get<{ Querystring: { status?: string; search?: string; supplierId?: string } }>(
    '/purchases',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const shopId = request.user!.shopId;
      const list = await listPurchases(
        shopId,
        request.query.status,
        request.query.search,
        request.query.supplierId
      );

      const response: ApiResponse = {
        success: true,
        data: list
      };
      return reply.send(response);
    }
  );

  // 2. Get Single Purchase Detail with Line Items & Payment History
  app.get<{ Params: { id: string } }>(
    '/purchases/:id',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const shopId = request.user!.shopId;
      const result = await getPurchaseById(shopId, request.params.id);

      if (!result) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'PURCHASE_NOT_FOUND',
            message: `Purchase bill '${request.params.id}' not found.`
          }
        };
        return reply.status(404).send(response);
      }

      const response: ApiResponse = {
        success: true,
        data: result
      };
      return reply.send(response);
    }
  );

  // 3. Create Atomic Inward Purchase Bill
  app.post(
    '/purchases',
    { preHandler: [authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parseResult = createPurchaseSchema.safeParse(request.body);
      if (!parseResult.success) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: parseResult.error.errors[0]?.message || 'Invalid purchase parameters'
          }
        };
        return reply.status(400).send(response);
      }

      const user = request.user!;
      const ipAddress = request.ip;

      try {
        const purchase = await createPurchaseTransaction(
          user.shopId,
          parseResult.data as any,
          user.id,
          user.name,
          ipAddress
        );

        const response: ApiResponse = {
          success: true,
          data: purchase
        };
        return reply.status(201).send(response);
      } catch (err: any) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'PURCHASE_CREATION_FAILED',
            message: err.message || 'Failed to finalize purchase bill'
          }
        };
        return reply.status(400).send(response);
      }
    }
  );

  // 4. Record Subsequent Supplier Payment on Purchase Bill
  app.post<{ Params: { id: string } }>(
    '/purchases/:id/payments',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const parseResult = recordSupplierPaymentSchema.safeParse(request.body);
      if (!parseResult.success) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: parseResult.error.errors[0]?.message || 'Invalid payment parameters'
          }
        };
        return reply.status(400).send(response);
      }

      const user = request.user!;
      const ipAddress = request.ip;

      try {
        const pmt = await recordPurchasePayment(
          user.shopId,
          request.params.id,
          parseResult.data as any,
          user.id,
          user.name,
          ipAddress
        );

        const response: ApiResponse = {
          success: true,
          data: pmt
        };
        return reply.status(201).send(response);
      } catch (err: any) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'PAYMENT_RECORDING_FAILED',
            message: err.message || 'Failed to record supplier payment'
          }
        };
        return reply.status(400).send(response);
      }
    }
  );
};
