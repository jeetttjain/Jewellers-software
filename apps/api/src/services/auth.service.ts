import { getDatabase } from '../db/connection.js';
import * as schema from '../db/schema/index.js';
import { verifyPassword, verifyPin, generateSessionToken, hashToken } from './crypto.js';
import { eq, and, gt } from 'drizzle-orm';

export interface AuthSessionResult {
  sessionToken: string;
  user: {
    id: string;
    shopId: string;
    name: string;
    email: string;
    role: string;
  };
  shop: {
    id: string;
    name: string;
    code: string;
    gstin: string | null;
  };
  expiresAt: Date;
}

export async function loginWithEmail(
  email: string,
  passwordPlain: string,
  ipAddress?: string,
  userAgent?: string
): Promise<AuthSessionResult> {
  const { db } = await getDatabase();

  const userRows = await db
    .select()
    .from(schema.users)
    .where(and(eq(schema.users.email, email.toLowerCase().trim()), eq(schema.users.isActive, true)))
    .limit(1);

  if (userRows.length === 0) {
    throw new Error('Invalid email or password');
  }

  const user = userRows[0];
  const isValid = await verifyPassword(passwordPlain, user.passwordHash);
  if (!isValid) {
    throw new Error('Invalid email or password');
  }

  const shopRows = await db.select().from(schema.shops).where(eq(schema.shops.id, user.shopId)).limit(1);
  const shop = shopRows[0];

  const sessionToken = generateSessionToken();
  const tokenHash = hashToken(sessionToken);
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

  await db.insert(schema.sessions).values({
    userId: user.id,
    shopId: user.shopId,
    tokenHash,
    expiresAt,
    revoked: false,
    ipAddress: ipAddress || null,
    userAgent: userAgent || null
  });

  return {
    sessionToken,
    user: {
      id: user.id,
      shopId: user.shopId,
      name: user.name,
      email: user.email,
      role: user.role
    },
    shop: {
      id: shop.id,
      name: shop.name,
      code: shop.code,
      gstin: shop.gstin
    },
    expiresAt
  };
}

export async function loginWithPin(
  pin: string,
  ipAddress?: string,
  userAgent?: string
): Promise<AuthSessionResult> {
  const { db } = await getDatabase();

  const activeUsers = await db.select().from(schema.users).where(eq(schema.users.isActive, true));

  let matchedUser: typeof schema.users.$inferSelect | null = null;

  for (const user of activeUsers) {
    if (user.pinHash) {
      const isPinMatch = await verifyPin(pin.trim(), user.pinHash);
      if (isPinMatch) {
        matchedUser = user;
        break;
      }
    }
  }

  if (!matchedUser) {
    throw new Error('Invalid staff PIN code');
  }

  const shopRows = await db.select().from(schema.shops).where(eq(schema.shops.id, matchedUser.shopId)).limit(1);
  const shop = shopRows[0];

  const sessionToken = generateSessionToken();
  const tokenHash = hashToken(sessionToken);
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  await db.insert(schema.sessions).values({
    userId: matchedUser.id,
    shopId: matchedUser.shopId,
    tokenHash,
    expiresAt,
    revoked: false,
    ipAddress: ipAddress || null,
    userAgent: userAgent || null
  });

  return {
    sessionToken,
    user: {
      id: matchedUser.id,
      shopId: matchedUser.shopId,
      name: matchedUser.name,
      email: matchedUser.email,
      role: matchedUser.role
    },
    shop: {
      id: shop.id,
      name: shop.name,
      code: shop.code,
      gstin: shop.gstin
    },
    expiresAt
  };
}

export async function validateSession(rawToken: string) {
  if (!rawToken) return null;
  const { db } = await getDatabase();
  const tokenHash = hashToken(rawToken);

  const sessionRows = await db
    .select({
      sessionId: schema.sessions.id,
      userId: schema.sessions.userId,
      shopId: schema.sessions.shopId,
      expiresAt: schema.sessions.expiresAt,
      revoked: schema.sessions.revoked,
      userName: schema.users.name,
      userEmail: schema.users.email,
      userRole: schema.users.role,
      userActive: schema.users.isActive,
      shopName: schema.shops.name,
      shopCode: schema.shops.code,
      shopGstin: schema.shops.gstin,
      shopTaxPercent: schema.shops.defaultTaxPercent,
      invoicePrefix: schema.shops.invoicePrefix
    })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.sessions.userId, schema.users.id))
    .innerJoin(schema.shops, eq(schema.sessions.shopId, schema.shops.id))
    .where(
      and(
        eq(schema.sessions.tokenHash, tokenHash),
        eq(schema.sessions.revoked, false),
        gt(schema.sessions.expiresAt, new Date())
      )
    )
    .limit(1);

  if (sessionRows.length === 0 || !sessionRows[0].userActive) {
    return null;
  }

  const s = sessionRows[0];

  // Update lastActiveAt asynchronously
  db.update(schema.sessions)
    .set({ lastActiveAt: new Date() })
    .where(eq(schema.sessions.id, s.sessionId))
    .catch(() => {});

  return {
    sessionId: s.sessionId,
    user: {
      id: s.userId,
      shopId: s.shopId,
      name: s.userName,
      email: s.userEmail,
      role: s.userRole
    },
    shop: {
      id: s.shopId,
      name: s.shopName,
      code: s.shopCode,
      gstin: s.shopGstin,
      defaultTaxPercent: s.shopTaxPercent,
      invoicePrefix: s.invoicePrefix
    }
  };
}

export async function revokeSession(rawToken: string): Promise<boolean> {
  if (!rawToken) return false;
  const { db } = await getDatabase();
  const tokenHash = hashToken(rawToken);

  await db
    .update(schema.sessions)
    .set({ revoked: true })
    .where(eq(schema.sessions.tokenHash, tokenHash));

  return true;
}
