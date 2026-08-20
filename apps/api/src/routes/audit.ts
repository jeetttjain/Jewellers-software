import { FastifyInstance, FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { getDatabase } from '../db/connection.js';
import * as schema from '../db/schema/index.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { ApiResponse } from '@jewellery-pos/shared';
import { eq, desc } from 'drizzle-orm';

export const auditRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.get('/audit', { preHandler: [authenticate, requireRole(['ADMIN'])] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const shopId = request.user!.shopId;
    const { db } = await getDatabase();

    const list = await db
      .select()
      .from(schema.auditLogs)
      .where(eq(schema.auditLogs.shopId, shopId))
      .orderBy(desc(schema.auditLogs.createdAt));

    const response: ApiResponse = {
      success: true,
      data: list
    };
    return reply.send(response);
  });
};

