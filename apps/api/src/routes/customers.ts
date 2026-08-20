import { FastifyInstance, FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { listCustomers, getCustomerById, createCustomer, recordCustomerPayment } from '../services/customers.service.js';
import { authenticate } from '../middleware/auth.js';
import { ApiResponse } from '@jewellery-pos/shared';
import { createCustomerSchema } from '@jewellery-pos/validation';

export const customerRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // 1. List Customers
  app.get<{ Querystring: { search?: string } }>(
    '/customers',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const shopId = request.user!.shopId;
      const list = await listCustomers(shopId, request.query.search);

      const response: ApiResponse = {
        success: true,
        data: list
      };
      return reply.send(response);
    }
  );

  // 2. Get Single Customer Profile with Khata Ledger & Invoice History
  app.get<{ Params: { id: string } }>(
    '/customers/:id',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const shopId = request.user!.shopId;
      const result = await getCustomerById(shopId, request.params.id);

      if (!result) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'CUSTOMER_NOT_FOUND',
            message: `Customer profile '${request.params.id}' not found.`
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

  // 3. Create New Customer Profile
  app.post(
    '/customers',
    { preHandler: [authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parseResult = createCustomerSchema.safeParse(request.body);
      if (!parseResult.success) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: parseResult.error.errors[0]?.message || 'Invalid customer details'
          }
        };
        return reply.status(400).send(response);
      }

      const shopId = request.user!.shopId;
      try {
        const customer = await createCustomer(shopId, {
          name: parseResult.data.name,
          mobile: parseResult.data.mobile,
          email: parseResult.data.email || undefined,
          pan: parseResult.data.pan || undefined,
          address: parseResult.data.address || undefined,
          city: parseResult.data.city || undefined,
          stateCode: parseResult.data.stateCode || undefined,
          gstin: parseResult.data.gstin || undefined
        });

        const response: ApiResponse = {
          success: true,
          data: customer
        };
        return reply.status(201).send(response);
      } catch (err: any) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'CUSTOMER_CREATION_FAILED',
            message: err.message || 'Failed to create customer'
          }
        };
        return reply.status(400).send(response);
      }
    }
  );

  // 4. Record Customer Dues Payment & Generate Settlement Voucher
  app.post(
    '/customers/:id/payment',
    { preHandler: [authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const params = request.params as { id: string };
      const body = (request.body || {}) as { amount: string; mode: any; referenceNo?: string };
      const { amount, mode, referenceNo } = body;
      const shopId = request.user!.shopId;

      try {
        const result = await recordCustomerPayment(
          shopId,
          params.id,
          amount,
          mode || 'CASH',
          referenceNo,
          request.user!.id,
          request.user!.name
        );

        const response: ApiResponse = {
          success: true,
          data: result
        };
        return reply.send(response);
      } catch (err: any) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'PAYMENT_RECORDING_FAILED',
            message: err.message || 'Failed to record customer payment'
          }
        };
        return reply.status(400).send(response);
      }
    }
  );
};
