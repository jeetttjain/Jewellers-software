import { FastifyInstance } from 'fastify';
import cookie from '@fastify/cookie';
import { env } from '../config/env.js';

export async function registerCookies(app: FastifyInstance) {
  await app.register(cookie, {
    secret: env.COOKIE_SECRET,
    hook: 'onRequest',
    parseOptions: {}
  });
}
