import { FastifyInstance, FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { getDashboardData } from '../services/dashboard.service.js';
import { authenticate } from '../middleware/auth.js';
import { ApiResponse } from '@jewellery-pos/shared';

export const dashboardRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.get('/dashboard', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const shopId = request.user!.shopId;
    try {
      const data = await getDashboardData(shopId);
      const response: ApiResponse = {
        success: true,
        data
      };
      return reply.send(response);
    } catch (err: any) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'DASHBOARD_FETCH_ERROR',
          message: err.message || 'Failed to fetch dashboard data'
        }
      };
      return reply.status(500).send(response);
    }
  });
};

