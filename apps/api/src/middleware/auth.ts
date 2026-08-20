import { FastifyRequest, FastifyReply } from 'fastify';
import { validateSession } from '../services/auth.service.js';

export interface AuthenticatedUser {
  id: string;
  shopId: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'MANAGER' | 'CLERK';
}

export interface AuthenticatedShop {
  id: string;
  name: string;
  code: string;
  gstin: string | null;
  defaultTaxPercent: string;
  invoicePrefix: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthenticatedUser;
    shop?: AuthenticatedShop;
    sessionId?: string;
  }
}

/**
 * Utility to extract session token cleanly from signed/unsigned cookies or Authorization header.
 */
export function extractSessionToken(request: FastifyRequest): string | undefined {
  let token: string | undefined = undefined;

  const cookie = (request.cookies as any)?.['pos_session'];
  if (cookie) {
    if (typeof request.unsignCookie === 'function') {
      const unsigned = request.unsignCookie(cookie);
      if (unsigned.valid && unsigned.value) {
        token = unsigned.value;
      } else {
        token = cookie;
      }
    } else {
      token = cookie;
    }
  }

  if (!token && request.headers.authorization) {
    const parts = request.headers.authorization.split(' ');
    if (parts.length === 2 && parts[0] === 'Bearer') {
      token = parts[1];
    }
  }

  return token;
}

/**
 * Authentication middleware for Fastify routes.
 * Extracts session token from signed cookies (or Bearer Authorization header).
 */
export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  const token = extractSessionToken(request);

  if (!token) {
    return reply.status(401).send({
      success: false,
      code: 'UNAUTHORIZED',
      message: 'Authentication session required. Please sign in.'
    });
  }

  const session = await validateSession(token);
  if (!session) {
    return reply.status(401).send({
      success: false,
      code: 'SESSION_EXPIRED',
      message: 'Session has expired or was revoked. Please log in again.'
    });
  }

  request.user = session.user as AuthenticatedUser;
  request.shop = session.shop as AuthenticatedShop;
  request.sessionId = session.sessionId;
}

/**
 * Role-Based Access Control (RBAC) guard.
 */
export function requireRole(allowedRoles: Array<'ADMIN' | 'MANAGER' | 'CLERK'>) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user) {
      return reply.status(401).send({
        success: false,
        code: 'UNAUTHORIZED',
        message: 'Authentication required'
      });
    }

    if (!allowedRoles.includes(request.user.role)) {
      return reply.status(403).send({
        success: false,
        code: 'FORBIDDEN',
        message: `Insufficient permissions. Allowed roles: ${allowedRoles.join(', ')}`
      });
    }
  };
}
