import { FastifyInstance, FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { loginWithEmail, loginWithPin, validateSession, revokeSession } from '../services/auth.service.js';
import { extractSessionToken } from '../middleware/auth.js';
import { createRateLimiter } from '../middleware/rateLimit.js';
import { ApiResponse, UserSession } from '@jewellery-pos/shared';
import { loginSchema } from '@jewellery-pos/validation';
import { env } from '../config/env.js';

export function getSessionCookieOptions(request?: FastifyRequest) {
  const isHttps = request ? (request.protocol === 'https' || request.headers['x-forwarded-proto'] === 'https') : false;
  return {
    path: '/',
    httpOnly: true,
    secure: env.isProd ? true : isHttps,
    sameSite: 'lax' as const,
    maxAge: 30 * 24 * 60 * 60 // 30 days
  };
}

// Rate limiters for authentication
const loginRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 15,
  maxFailedAttempts: 5,
  lockoutMs: 5 * 60 * 1000,
  keyPrefix: 'login'
});

const pinLoginRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 20,
  maxFailedAttempts: 5,
  lockoutMs: 5 * 60 * 1000,
  keyPrefix: 'pin_login'
});

export const authRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // 1. Email + Password Login
  app.post(
    '/auth/login',
    { preHandler: [loginRateLimiter] },
    async (request: FastifyRequest, reply: FastifyReply) => {
    const parseResult = loginSchema.safeParse(request.body);
    if (!parseResult.success) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: parseResult.error.errors[0]?.message || 'Invalid login details'
        }
      };
      return reply.status(400).send(response);
    }

    const { email, password } = parseResult.data;

    try {
      const authResult = await loginWithEmail(
        email,
        password,
        request.ip,
        request.headers['user-agent']
      );

      // Set HTTP-Only Session Cookie
      reply.setCookie('pos_session', authResult.sessionToken, getSessionCookieOptions(request));

      const session: UserSession = {
        id: authResult.user.id,
        shopId: authResult.user.shopId,
        name: authResult.user.name,
        email: authResult.user.email,
        role: authResult.user.role as any
      };

      const response: ApiResponse<{ session: UserSession; token: string }> = {
        success: true,
        data: {
          session,
          token: authResult.sessionToken
        }
      };
      return reply.send(response);
    } catch (err: any) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: err.message || 'Invalid email or password'
        }
      };
      return reply.status(401).send(response);
    }
  });

  // 2. 4-Digit Quick Cashier PIN Login
  app.post<{ Body: { pin: string } }>(
    '/auth/pin-login',
    { preHandler: [pinLoginRateLimiter] },
    async (request, reply) => {
    const { pin } = request.body || {};
    if (!pin || pin.length !== 4) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'INVALID_PIN',
          message: 'PIN must be a 4-digit numeric code'
        }
      };
      return reply.status(400).send(response);
    }

    try {
      const authResult = await loginWithPin(
        pin,
        request.ip,
        request.headers['user-agent']
      );

      reply.setCookie('pos_session', authResult.sessionToken, getSessionCookieOptions(request));

      const session: UserSession = {
        id: authResult.user.id,
        shopId: authResult.user.shopId,
        name: authResult.user.name,
        email: authResult.user.email,
        role: authResult.user.role as any
      };

      const response: ApiResponse<{ session: UserSession; token: string }> = {
        success: true,
        data: {
          session,
          token: authResult.sessionToken
        }
      };
      return reply.send(response);
    } catch (err: any) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'UNAUTHORIZED_PIN',
          message: err.message || 'Invalid staff PIN code'
        }
      };
      return reply.status(401).send(response);
    }
  });

  // 3. Current Session Validation (/auth/me)
  app.get('/auth/me', async (request: FastifyRequest, reply: FastifyReply) => {
    const token = extractSessionToken(request);

    if (!token) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'No active session found'
        }
      };
      return reply.status(401).send(response);
    }

    const sessionData = await validateSession(token);
    if (!sessionData) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'SESSION_EXPIRED',
          message: 'Session has expired or was revoked'
        }
      };
      return reply.status(401).send(response);
    }

    const response: ApiResponse<UserSession> = {
      success: true,
      data: {
        id: sessionData.user.id,
        shopId: sessionData.user.shopId,
        name: sessionData.user.name,
        email: sessionData.user.email,
        role: sessionData.user.role as any
      }
    };
    return reply.send(response);
  });

  // 4. Logout / Session Revocation
  app.post('/auth/logout', async (request: FastifyRequest, reply: FastifyReply) => {
    const token = extractSessionToken(request);

    if (token) {
      await revokeSession(token);
    }

    reply.clearCookie('pos_session', { path: '/' });

    const response: ApiResponse = {
      success: true,
      data: { message: 'Logged out successfully' }
    };
    return reply.send(response);
  });
};
