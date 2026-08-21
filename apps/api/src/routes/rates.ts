import { FastifyInstance, FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import {
  getLatestRates,
  getRatesHistory,
  getRateDefinitions,
  createRateDefinition,
  updateRateDefinition,
  publishDailyRates,
  createRatesSnapshot,
  getHistoricalRate
} from '../services/rates.service.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { ApiResponse } from '@jewellery-pos/shared';
import {
  updateRatesSchema,
  rateDefinitionSchema,
  updateRateDefinitionSchema,
  publishDailyRatesSchema
} from '@jewellery-pos/validation';

export const ratesRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // 1. Get Latest Bullion Board Rates & Active Definitions (Counter display)
  app.get('/rates', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const shopId = request.user!.shopId;
    const rates = await getLatestRates(shopId);

    const response: ApiResponse = {
      success: true,
      data: rates
    };
    return reply.send(response);
  });

  // 2. Get All Rate Master Definitions (Active & Inactive for Showroom Rate Management)
  app.get('/rates/definitions', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const shopId = request.user!.shopId;
    const definitions = await getRateDefinitions(shopId, true);

    const response: ApiResponse = {
      success: true,
      data: definitions
    };
    return reply.send(response);
  });

  // 3. Get Immutable Rate Change History Log with Optional Filters
  app.get('/rates/history', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const shopId = request.user!.shopId;
    const query = (request.query || {}) as {
      metal?: string;
      purity?: string;
      fromDate?: string;
      toDate?: string;
    };

    const history = await getRatesHistory(shopId, query);

    const response: ApiResponse = {
      success: true,
      data: history
    };
    return reply.send(response);
  });

  // 3b. Query Historical Rate as of specific Date & Time
  app.get('/rates/historical', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const shopId = request.user!.shopId;
    const query = (request.query || {}) as {
      metal?: string;
      purity?: string;
      fineness?: string;
      asOfDate?: string;
    };

    if (!query.metal || !query.asOfDate) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Both metal and asOfDate query parameters are required for historical rate lookup.'
        }
      };
      return reply.status(400).send(response);
    }

    try {
      const rateInfo = await getHistoricalRate(shopId, {
        metal: query.metal,
        purity: query.purity,
        fineness: query.fineness ? parseInt(query.fineness, 10) : undefined,
        asOfDate: query.asOfDate
      });

      const response: ApiResponse = {
        success: true,
        data: rateInfo
      };
      return reply.send(response);
    } catch (err: any) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'HISTORICAL_RATE_ERROR',
          message: err.message || 'Failed to lookup historical rate'
        }
      };
      return reply.status(400).send(response);
    }
  });

  // 4. Create New Rate Master Definition (Owner ADMIN only)
  app.post(
    '/rates/definitions',
    { preHandler: [authenticate, requireRole(['ADMIN'])] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parseResult = rateDefinitionSchema.safeParse(request.body);
      if (!parseResult.success) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: parseResult.error.errors[0]?.message || 'Invalid rate definition payload'
          }
        };
        return reply.status(400).send(response);
      }

      const shopId = request.user!.shopId;
      try {
        const definition = await createRateDefinition(
          shopId,
          {
            metal: parseResult.data.metal,
            purity: parseResult.data.purity,
            fineness: parseResult.data.fineness,
            currentRate: parseResult.data.currentRate.toString(),
            isActive: parseResult.data.isActive,
            sortOrder: parseResult.data.sortOrder
          },
          request.user!.id,
          request.user!.name
        );

        const response: ApiResponse = {
          success: true,
          data: definition
        };
        return reply.status(201).send(response);
      } catch (err: any) {
        const statusCode = err.statusCode || (err.code === 'DUPLICATE_PURITY' ? 409 : 400);
        const response: ApiResponse = {
          success: false,
          error: {
            code: err.code || 'RATE_DEFINITION_ERROR',
            message: err.message || 'Failed to create rate definition'
          }
        };
        return reply.status(statusCode).send(response);
      }
    }
  );

  // 5. Update Existing Rate Master Definition (Owner ADMIN only - Identity metal/purity/fineness immutable)
  app.put(
    '/rates/definitions/:id',
    { preHandler: [authenticate, requireRole(['ADMIN'])] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const parseResult = updateRateDefinitionSchema.safeParse(request.body);
      if (!parseResult.success) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: parseResult.error.errors[0]?.message || 'Invalid rate update payload'
          }
        };
        return reply.status(400).send(response);
      }

      const shopId = request.user!.shopId;
      try {
        const updated = await updateRateDefinition(
          shopId,
          id,
          {
            currentRate: parseResult.data.currentRate?.toString(),
            isActive: parseResult.data.isActive,
            sortOrder: parseResult.data.sortOrder,
            changeReason: parseResult.data.changeReason
          },
          request.user!.id,
          request.user!.name
        );

        const response: ApiResponse = {
          success: true,
          data: updated
        };
        return reply.send(response);
      } catch (err: any) {
        const statusCode = err.statusCode || 400;
        const response: ApiResponse = {
          success: false,
          error: {
            code: err.code || 'RATE_UPDATE_ERROR',
            message: err.message || 'Failed to update rate definition'
          }
        };
        return reply.status(statusCode).send(response);
      }
    }
  );

  // 6. Toggle Active/Inactive Status for a Rate Definition (Owner ADMIN only)
  app.patch(
    '/rates/definitions/:id/status',
    { preHandler: [authenticate, requireRole(['ADMIN'])] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const body = (request.body || {}) as { isActive?: boolean; changeReason?: string };
      const shopId = request.user!.shopId;
      const isActive = Boolean(body.isActive);

      try {
        const updated = await updateRateDefinition(
          shopId,
          id,
          { isActive, changeReason: body.changeReason },
          request.user!.id,
          request.user!.name
        );

        const response: ApiResponse = {
          success: true,
          data: updated
        };
        return reply.send(response);
      } catch (err: any) {
        const statusCode = err.statusCode || 400;
        const response: ApiResponse = {
          success: false,
          error: {
            code: err.code || 'RATE_STATUS_ERROR',
            message: err.message || 'Failed to toggle rate status'
          }
        };
        return reply.status(statusCode).send(response);
      }
    }
  );

  // 7. Bulk Publish Today's Rates across active definitions (Owner ADMIN only)
  app.post(
    '/rates/publish',
    { preHandler: [authenticate, requireRole(['ADMIN'])] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parseResult = publishDailyRatesSchema.safeParse(request.body);
      if (!parseResult.success) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: parseResult.error.errors[0]?.message || 'Invalid publish payload'
          }
        };
        return reply.status(400).send(response);
      }

      const shopId = request.user!.shopId;
      try {
        const updated = await publishDailyRates(
          shopId,
          parseResult.data.rates.map((r: any) => ({ id: r.id, rate: r.rate.toString() })),
          request.user!.id,
          request.user!.name,
          parseResult.data.changeReason
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
            code: 'RATE_PUBLISH_ERROR',
            message: err.message || 'Failed to publish daily rates'
          }
        };
        return reply.status(400).send(response);
      }
    }
  );

  // 8. Legacy Publish Endpoint (Owner ADMIN only - preserves backward compatibility)
  app.post(
    '/rates',
    { preHandler: [authenticate, requireRole(['ADMIN'])] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parseResult = updateRatesSchema.safeParse(request.body);
      if (!parseResult.success) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: parseResult.error.errors[0]?.message || 'Invalid rate payload'
          }
        };
        return reply.status(400).send(response);
      }

      const shopId = request.user!.shopId;
      const rates = await createRatesSnapshot(
        shopId,
        {
          rate24k: parseResult.data.rate24k.toString(),
          rate22k: parseResult.data.rate22k.toString(),
          rate18k: parseResult.data.rate18k.toString(),
          rateSilver: parseResult.data.rateSilver.toString(),
          ratePlatinum: parseResult.data.ratePlatinum?.toString()
        },
        request.user!.id,
        request.user!.name
      );

      const response: ApiResponse = {
        success: true,
        data: rates
      };
      return reply.send(response);
    }
  );
};
