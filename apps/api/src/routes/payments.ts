import { FastifyInstance, FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { getDatabase } from '../db/connection.js';
import * as schema from '../db/schema/index.js';
import { authenticate } from '../middleware/auth.js';
import { ApiResponse } from '@jewellery-pos/shared';
import { eq, desc } from 'drizzle-orm';

export const paymentsRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.get('/payments', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const shopId = request.user!.shopId;
    const { db } = await getDatabase();

    const list = await db
      .select()
      .from(schema.payments)
      .where(eq(schema.payments.shopId, shopId))
      .orderBy(desc(schema.payments.createdAt));

    const response: ApiResponse = {
      success: true,
      data: list
    };
    return reply.send(response);
  });
};

