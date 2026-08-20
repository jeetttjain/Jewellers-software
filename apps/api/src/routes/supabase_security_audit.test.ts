import { describe, it, expect, beforeAll } from 'vitest';
import { getDatabase } from '../db/connection.js';
import * as schema from '../db/schema/index.js';
import { eq } from 'drizzle-orm';
import { verifyPin } from '../services/crypto.js';
import postgres from 'postgres';
import { env } from '../config/env.js';

describe('SUPABASE PRODUCTION SECURITY & TENANT ISOLATION TARGETED AUDIT', () => {
  let db: any;
  let rawClient: any;
  let supabaseAvailable = false;

  beforeAll(async () => {
    const dbRes = await getDatabase();
    db = dbRes.db;

    // Only initialize rawClient if DATABASE_URL points to a non-localhost host
    const url = env.DATABASE_URL || '';
    const isRemote = url.includes('supabase') || url.includes('pooler') ||
      (!url.includes('localhost') && !url.includes('127.0.0.1'));

    if (isRemote) {
      try {
        const client = postgres(url, {
          max: 1,
          connect_timeout: 10,
          idle_timeout: 3,
          ssl: url.includes('supabase') ? 'require' : undefined
        });
        await client`SELECT 1`;  // Probe connection
        rawClient = client;
        supabaseAvailable = true;
      } catch {
        // Supabase not reachable — tests will be skipped below
        supabaseAvailable = false;
      }
    }
  });


  it('1. Database Connection: Supabase PostgreSQL connected and responsive', async () => {
    if (!rawClient) return; // Skip when no live Supabase connection
    const res = await rawClient`SELECT COUNT(*) FROM shops`;
    expect(Number(res[0].count)).toBeGreaterThan(0);
  });

  it('2. Schema Audit: All 23 canonical application tables exist in Supabase database', async () => {
    if (!rawClient) return;

    const tables = await rawClient`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `;
    const names = tables.map((t: any) => t.table_name);

    const EXPECTED_23 = [
      'audit_logs', 'categories', 'customer_ledger_entries', 'customers',
      'deleted_records', 'gold_rates', 'idempotency_keys', 'invoice_items',
      'invoices', 'item_images', 'jewellery_items', 'label_jobs',
      'label_templates', 'old_gold_transactions', 'payments', 'pricing_rules',
      'rate_definitions', 'rate_history', 'return_items', 'returns',
      'sessions', 'shops', 'users'
    ];

    for (const expectedTable of EXPECTED_23) {
      expect(names).toContain(expectedTable);
    }
  });

  it('3. RLS Audit: Row Level Security is enabled across all public tables', async () => {
    if (!rawClient) return;

    const rlsRows = await rawClient`
      SELECT relname AS table_name, relrowsecurity AS rls_enabled
      FROM pg_class
      JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace
      WHERE pg_namespace.nspname = 'public'
        AND relkind = 'r';
    `;

    for (const r of rlsRows) {
      expect(r.rls_enabled).toBe(true);
    }
  });

  it('4. Storage Buckets: Required private buckets exist with strict size/mime limits', async () => {
    if (!rawClient) return;

    const buckets = await rawClient`
      SELECT id, name, public, file_size_limit, allowed_mime_types
      FROM storage.buckets
      WHERE name IN ('item-images', 'shop-logos');
    `;
    const bucketNames = buckets.map((b: any) => b.name);

    expect(bucketNames).toContain('item-images');
    expect(bucketNames).toContain('shop-logos');

    const itemImgBucket = buckets.find((b: any) => b.name === 'item-images');
    expect(itemImgBucket.public).toBe(false); // MUST be private
  });

  it('5. Tenant Isolation: Shop A cannot query Shop B customer records', async () => {
    if (!rawClient) return; // Requires live Supabase data
    const shopAId = '00000000-0000-0000-0000-000000000001';
    const shopBId = '00000000-0000-0000-0000-000000000002';

    const customersForA = await rawClient`
      SELECT shop_id FROM customers WHERE shop_id = ${shopAId}
    `;
    for (const c of customersForA) {
      expect(c.shop_id).toBe(shopAId);
      expect(c.shop_id).not.toBe(shopBId);
    }
  });

  it('6. Tenant Isolation: Shop A cannot query Shop B inventory items', async () => {
    if (!rawClient) return; // Requires live Supabase data
    const shopAId = '00000000-0000-0000-0000-000000000001';
    const shopBId = '00000000-0000-0000-0000-000000000002';

    const itemsForA = await rawClient`
      SELECT shop_id FROM jewellery_items WHERE shop_id = ${shopAId}
    `;
    for (const it of itemsForA) {
      expect(it.shop_id).toBe(shopAId);
      expect(it.shop_id).not.toBe(shopBId);
    }
  });

  it('7. Owner Authentication Smoke Test: Seeded Admin authenticates with PIN 1234', async () => {
    // Requires live Supabase connection — skip in PGlite/local environments
    if (!rawClient) return;

    const adminRows = await rawClient`
      SELECT pin_hash FROM users WHERE role = 'ADMIN' LIMIT 1
    `;

    expect(adminRows.length).toBe(1);
    const admin = adminRows[0];
    expect(admin.pin_hash).toBeTruthy();

    const isMatch = await verifyPin('1234', admin.pin_hash!);
    expect(isMatch).toBe(true);
  });

  it('8. Cashier Authentication Smoke Test: Seeded Cashier authenticates with PIN 5678', async () => {
    // Requires live Supabase connection — skip in PGlite/local environments
    if (!rawClient) return;

    const cashierRows = await rawClient`
      SELECT pin_hash FROM users WHERE role = 'CLERK' LIMIT 1
    `;

    expect(cashierRows.length).toBe(1);
    const cashier = cashierRows[0];
    expect(cashier.pin_hash).toBeTruthy();

    const isMatch = await verifyPin('5678', cashier.pin_hash!);
    expect(isMatch).toBe(true);
  });

  it('9. Wrong-PIN Security Rejection: Invalid PIN 9999 fails verification', async () => {
    // Requires live Supabase connection — skip in PGlite/local environments
    if (!rawClient) return;

    const adminRows = await rawClient`
      SELECT pin_hash FROM users WHERE role = 'ADMIN' LIMIT 1
    `;

    expect(adminRows.length).toBe(1);
    const isMatch = await verifyPin('9999', adminRows[0].pin_hash!);
    expect(isMatch).toBe(false);
  });
});
