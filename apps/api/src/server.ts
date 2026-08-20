import Fastify, { FastifyInstance, FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { randomUUID } from 'crypto';
import { registerSecurity } from './plugins/security.js';
import { registerCors } from './plugins/cors.js';
import { registerCookies } from './plugins/cookies.js';
import { healthRoutes } from './routes/health.js';
import { authRoutes } from './routes/auth.js';
import { ratesRoutes } from './routes/rates.js';
import { itemsRoutes } from './routes/items.js';
import { scanRoutes } from './routes/scan.js';
import { customerRoutes } from './routes/customers.js';
import { billingRoutes } from './routes/billing.js';
import { oldGoldRoutes } from './routes/oldGold.js';
import { returnsRoutes } from './routes/returns.js';
import { paymentsRoutes } from './routes/payments.js';
import { auditRoutes } from './routes/audit.js';
import { settingsRoutes } from './routes/settings.js';
import { labelsRoutes } from './routes/labels.js';
import { dashboardRoutes } from './routes/dashboard.js';
import { backupRoutes } from './routes/backup.js';
import { itemAssetRoutes } from './routes/item_assets.js';
import { getDatabase, initDatabase } from './db/connection.js';
import { ApiResponse } from '@jewellery-pos/shared';
import { env } from './config/env.js';

export async function buildServer(): Promise<FastifyInstance> {
  // Ensure database initialization
  try {
    const { db } = await getDatabase();
    await initDatabase(db);
  } catch (err: any) {
    if (env.isProd) {
      throw new Error(`[FATAL DATABASE ERROR]: Unable to connect to production PostgreSQL: ${err.message}`);
    }
  }

  const app = Fastify({
    logger: env.isDev
      ? {
          level: 'info'
        }
      : {
          level: 'warn'
        },
    genReqId: () => randomUUID(),
    disableRequestLogging: false
  });

  await registerSecurity(app);
  await registerCors(app);
  await registerCookies(app);

  app.setErrorHandler((error: FastifyError, request: FastifyRequest, reply: FastifyReply) => {
    request.log.error(error);

    const statusCode = error.statusCode && error.statusCode >= 400 && error.statusCode < 600
      ? error.statusCode
      : 500;

    const safeMessage = env.isProd && statusCode >= 500
      ? 'An unexpected internal server error occurred. Please try again later.'
      : (error.message || 'An unexpected server error occurred');

    const response: ApiResponse = {
      success: false,
      error: {
        code: error.code || 'INTERNAL_SERVER_ERROR',
        message: safeMessage,
        details: env.isProd ? undefined : (error.validation || undefined)
      },
      meta: {
        requestId: request.id,
        timestamp: new Date().toISOString()
      }
    };

    reply.status(statusCode).send(response);
  });

  app.setNotFoundHandler((request: FastifyRequest, reply: FastifyReply) => {
    const response: ApiResponse = {
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: `Endpoint ${request.method} ${request.url} not found`
      },
      meta: {
        requestId: request.id,
        timestamp: new Date().toISOString()
      }
    };
    reply.status(404).send(response);
  });

  await app.register(healthRoutes, { prefix: '/api/v1' });
  await app.register(authRoutes, { prefix: '/api/v1' });
  await app.register(ratesRoutes, { prefix: '/api/v1' });
  await app.register(itemsRoutes, { prefix: '/api/v1' });
  await app.register(scanRoutes, { prefix: '/api/v1' });
  await app.register(customerRoutes, { prefix: '/api/v1' });
  await app.register(billingRoutes, { prefix: '/api/v1' });
  await app.register(oldGoldRoutes, { prefix: '/api/v1' });
  await app.register(returnsRoutes, { prefix: '/api/v1' });
  await app.register(paymentsRoutes, { prefix: '/api/v1' });
  await app.register(auditRoutes, { prefix: '/api/v1' });
  await app.register(settingsRoutes, { prefix: '/api/v1' });
  await app.register(labelsRoutes, { prefix: '/api/v1' });
  await app.register(dashboardRoutes, { prefix: '/api/v1' });
  await app.register(backupRoutes, { prefix: '/api/v1' });
  await app.register(itemAssetRoutes, { prefix: '/api/v1' });

  return app;
}
