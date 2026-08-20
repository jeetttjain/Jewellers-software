import { FastifyRequest, FastifyReply } from 'fastify';
import { ApiResponse } from '@jewellery-pos/shared';

interface RateLimitEntry {
  count: number;
  resetTime: number;
  failedCount: number;
  lockedUntil?: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// Periodic cleanup of expired rate limit entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime && (!entry.lockedUntil || now > entry.lockedUntil)) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000).unref();

export interface RateLimitOptions {
  windowMs: number;
  maxRequests: number;
  maxFailedAttempts?: number;
  lockoutMs?: number;
  keyPrefix?: string;
  skipSuccessfulRequests?: boolean;
}

/**
 * Creates a Fastify preHandler hook for rate-limiting requests by IP or custom key.
 */
export function createRateLimiter(options: RateLimitOptions) {
  const {
    windowMs,
    maxRequests,
    maxFailedAttempts,
    lockoutMs = 5 * 60 * 1000,
    keyPrefix = 'rl'
  } = options;

  return async (request: FastifyRequest, reply: FastifyReply) => {
    const ip = request.ip || '127.0.0.1';
    const key = `${keyPrefix}:${ip}`;
    const now = Date.now();

    let entry = rateLimitStore.get(key);

    if (!entry || now > entry.resetTime) {
      entry = {
        count: 1,
        resetTime: now + windowMs,
        failedCount: 0
      };
      rateLimitStore.set(key, entry);
    } else {
      entry.count += 1;
    }

    // Check lockout from repeated failures
    if (entry.lockedUntil && now < entry.lockedUntil) {
      const retryAfterSec = Math.ceil((entry.lockedUntil - now) / 1000);
      reply.header('Retry-After', retryAfterSec.toString());
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'RATE_LIMIT_LOCKED',
          message: `Too many failed attempts. Temporarily locked. Please try again in ${retryAfterSec} seconds.`
        }
      };
      return reply.status(429).send(response);
    }

    // Check request volume limit
    if (entry.count > maxRequests) {
      const retryAfterSec = Math.ceil((entry.resetTime - now) / 1000);
      reply.header('Retry-After', retryAfterSec.toString());
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: `Rate limit exceeded. Maximum ${maxRequests} requests per ${Math.round(windowMs / 1000)}s allowed. Try again in ${retryAfterSec}s.`
        }
      };
      return reply.status(429).send(response);
    }

    // Attach failure recorder callback to reply
    if (maxFailedAttempts) {
      const originalSend = reply.send.bind(reply);
      reply.send = function (payload: any) {
        if (reply.statusCode >= 400 && reply.statusCode !== 429) {
          entry!.failedCount += 1;
          if (entry!.failedCount >= maxFailedAttempts) {
            entry!.lockedUntil = Date.now() + lockoutMs;
          }
        } else if (reply.statusCode >= 200 && reply.statusCode < 300) {
          // Reset failed count on success
          entry!.failedCount = 0;
          entry!.lockedUntil = undefined;
        }
        return originalSend(payload);
      };
    }
  };
}

/**
 * Utility to manually clear rate limit for testing purposes.
 */
export function resetRateLimits() {
  rateLimitStore.clear();
}
