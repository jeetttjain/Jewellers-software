import { FastifyInstance, FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { createInvoiceTransaction, getInvoiceById, listInvoices } from '../services/billing.service.js';
import { authenticate } from '../middleware/auth.js';
import { ApiResponse } from '@jewellery-pos/shared';

export const billingRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // 1. List Invoices Directory
  app.get('/invoices', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const shopId = request.user!.shopId;
    const invoices = await listInvoices(shopId);

    const response: ApiResponse = {
      success: true,
      data: invoices
    };
    return reply.send(response);
  });

  // 2. Get Single Invoice with Line Items
  app.get<{ Params: { id: string } }>(
    '/invoices/:id',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const shopId = request.user!.shopId;
      const invoice = await getInvoiceById(shopId, request.params.id);

      if (!invoice) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'INVOICE_NOT_FOUND',
            message: `Invoice #${request.params.id} not found.`
          }
        };
        return reply.status(404).send(response);
      }

      const response: ApiResponse = {
        success: true,
        data: invoice
      };
      return reply.send(response);
    }
  );

  // 3. Confirm Sale & Create Invoice (Single Atomic Transaction + Idempotency)
  app.post(
    '/invoices',
    { preHandler: [authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = (request.body || {}) as any;
      const idempotencyKey = (request.headers['idempotency-key'] as string) || body.idempotencyKey;

      const shopId = request.user!.shopId;
      const userId = request.user!.id;
      const userName = request.user!.name;

      try {
        const invoice = await createInvoiceTransaction(
          {
            ...body,
            idempotencyKey
          },
          userId,
          userName,
          shopId,
          request.ip
        );

        const response: ApiResponse = {
          success: true,
          data: invoice
        };
        return reply.status(201).send(response);
      } catch (err: any) {
        const isDoubleSale = err.message?.includes('DOUBLE SALE PREVENTED') || err.message?.includes('already SOLD');
        const isCompliance = err.message?.includes('Rule 114B') || err.message?.includes('Section 269ST');

        const response: ApiResponse = {
          success: false,
          error: {
            code: isDoubleSale
              ? 'ITEM_ALREADY_SOLD'
              : isCompliance
              ? 'COMPLIANCE_VIOLATION'
              : 'TRANSACTION_FAILED',
            message: err.message || 'Failed to complete sale transaction'
          }
        };
        return reply.status(isDoubleSale ? 409 : 400).send(response);
      }
    }
  );
};
