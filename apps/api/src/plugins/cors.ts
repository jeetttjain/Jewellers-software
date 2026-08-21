import { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { env } from '../config/env.js';

export async function registerCors(app: FastifyInstance) {
  await app.register(cors, {
    origin: (origin, cb) => {
      // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
      if (!origin) {
        return cb(null, true);
      }

      const configuredOrigins = (env.WEB_ORIGIN || '')
        .split(',')
        .map((o) => o.trim().replace(/\/+$/, ''))
        .filter(Boolean);

      const defaultOrigins = [
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        'http://localhost:4173',
        'http://127.0.0.1:4173'
      ];

      const normalizedOrigin = origin.replace(/\/+$/, '');

      if (
        configuredOrigins.includes(normalizedOrigin) ||
        defaultOrigins.includes(normalizedOrigin) ||
        /^https:\/\/[a-zA-Z0-9_-]+\.vercel\.app$/.test(normalizedOrigin)
      ) {
        return cb(null, true);
      }

      return cb(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Idempotency-Key', 'Accept', 'X-Forwarded-Proto'],
    exposedHeaders: ['Idempotency-Key', 'X-Backup-Filename']
  });
}
