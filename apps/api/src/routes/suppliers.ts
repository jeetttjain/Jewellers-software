import { FastifyInstance, FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import {
  listSuppliers,
  getSupplierById,
  createSupplier,
  updateSupplier,
  deleteSupplier
} from '../services/suppliers.service.js';
import { getSupplierLedger } from '../services/supplierLedger.service.js';
import { authenticate } from '../middleware/auth.js';
import { ApiResponse } from '@jewellery-pos/shared';
import { createSupplierSchema, updateSupplierSchema } from '@jewellery-pos/validation';

export const supplierRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // 1. List Suppliers (with optional search and active filter)
  app.get<{ Querystring: { search?: string; active?: string } }>(
    '/suppliers',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const shopId = request.user!.shopId;
      const filterActive = request.query.active !== undefined ? request.query.active === 'true' : undefined;
      const list = await listSuppliers(shopId, request.query.search, filterActive);

      const response: ApiResponse = {
        success: true,
        data: list
      };
      return reply.send(response);
    }
  );

  // 2. Get Single Supplier Profile
  app.get<{ Params: { id: string } }>(
    '/suppliers/:id',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const shopId = request.user!.shopId;
      const supplier = await getSupplierById(shopId, request.params.id);

      if (!supplier) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'SUPPLIER_NOT_FOUND',
            message: `Supplier profile '${request.params.id}' not found.`
          }
        };
        return reply.status(404).send(response);
      }

      const response: ApiResponse = {
        success: true,
        data: supplier
      };
      return reply.send(response);
    }
  );

  // 3. Get Supplier Ledger Statement
  app.get<{ Params: { id: string }; Querystring: { startDate?: string; endDate?: string } }>(
    '/suppliers/:id/ledger',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const shopId = request.user!.shopId;
      try {
        const ledger = await getSupplierLedger(
          shopId,
          request.params.id,
          request.query.startDate,
          request.query.endDate
        );

        const response: ApiResponse = {
          success: true,
          data: ledger
        };
        return reply.send(response);
      } catch (err: any) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'LEDGER_FETCH_FAILED',
            message: err.message || 'Failed to fetch supplier ledger'
          }
        };
        return reply.status(404).send(response);
      }
    }
  );

  // 4. Create New Supplier
  app.post(
    '/suppliers',
    { preHandler: [authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parseResult = createSupplierSchema.safeParse(request.body);
      if (!parseResult.success) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: parseResult.error.errors[0]?.message || 'Invalid supplier details'
          }
        };
        return reply.status(400).send(response);
      }

      const user = request.user!;
      const ipAddress = request.ip;

      try {
        const created = await createSupplier(
          user.shopId,
          parseResult.data as any,
          user.id,
          user.name,
          ipAddress
        );

        const response: ApiResponse = {
          success: true,
          data: created
        };
        return reply.status(201).send(response);
      } catch (err: any) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'SUPPLIER_CREATION_FAILED',
            message: err.message || 'Failed to create supplier'
          }
        };
        return reply.status(400).send(response);
      }
    }
  );

  // 5. Update Supplier
  app.put<{ Params: { id: string } }>(
    '/suppliers/:id',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const parseResult = updateSupplierSchema.safeParse(request.body);
      if (!parseResult.success) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: parseResult.error.errors[0]?.message || 'Invalid update parameters'
          }
        };
        return reply.status(400).send(response);
      }

      const user = request.user!;
      const ipAddress = request.ip;

      try {
        const updated = await updateSupplier(
          user.shopId,
          request.params.id,
          parseResult.data as any,
          user.id,
          user.name,
          ipAddress
        );

        const response: ApiResponse = {
          success: true,
          data: updated
        };
        return reply.send(response);
      } catch (err: any) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'SUPPLIER_UPDATE_FAILED',
            message: err.message || 'Failed to update supplier'
          }
        };
        return reply.status(400).send(response);
      }
    }
  );

  // 6. Delete or Deactivate Supplier
  app.delete<{ Params: { id: string } }>(
    '/suppliers/:id',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const user = request.user!;
      const ipAddress = request.ip;

      try {
        const res = await deleteSupplier(
          user.shopId,
          request.params.id,
          user.id,
          user.name,
          ipAddress
        );

        const response: ApiResponse = {
          success: true,
          data: res
        };
        return reply.send(response);
      } catch (err: any) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'SUPPLIER_DELETE_FAILED',
            message: err.message || 'Failed to delete supplier'
          }
        };
        return reply.status(400).send(response);
      }
    }
  );
};
