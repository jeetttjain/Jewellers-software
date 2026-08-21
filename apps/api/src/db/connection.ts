import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema/index.js';
import { env } from '../config/env.js';
import fs from 'fs';
import path from 'path';
import net from 'net';
import { fileURLToPath } from 'url';

let dbInstance: any = null;
let clientInstance: any = null;
let isEmbedded = false;

function checkPortOpen(port: number, host: string, timeoutMs = 250): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();

    socket.setTimeout(timeoutMs);
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });

    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });

    socket.once('error', () => {
      socket.destroy();
      resolve(false);
    });

    socket.connect(port, host);
  });
}

/**
 * Initializes and returns the Drizzle ORM instance.
 * Production STRICTLY enforces standard PostgreSQL via TCP (DATABASE_URL).
 * Test/Local environments fallback to persistent PGlite when external PostgreSQL daemon is unavailable.
 */
export async function getDatabase() {
  if (dbInstance) {
    return { db: dbInstance, isEmbedded };
  }

  // 1. In production or when external DATABASE_URL is configured, connect directly to PostgreSQL
  if (env.DATABASE_URL && (env.DATABASE_URL.startsWith('postgresql://') || env.DATABASE_URL.startsWith('postgres://'))) {
    const isLocalhost = env.DATABASE_URL.includes('localhost') || env.DATABASE_URL.includes('127.0.0.1');
    
    if (env.isProd || !isLocalhost) {
      try {
        clientInstance = postgres(env.DATABASE_URL, {
          max: env.isProd ? 20 : 10,
          idle_timeout: 30,
          connect_timeout: 10,
          ssl: env.DATABASE_URL.includes('supabase') ? 'require' : undefined
        });
        await clientInstance`SELECT 1`;
        dbInstance = drizzle(clientInstance, { schema });
        isEmbedded = false;
        return { db: dbInstance, isEmbedded };
      } catch (err) {
        if (env.isProd) {
          throw new Error(`[FATAL] Failed to connect to PostgreSQL via DATABASE_URL: ${(err as Error).message}`);
        }
        // If external connection failed in dev, fall through
      }
    } else {
      const isPostgresRunning = await checkPortOpen(5432, '127.0.0.1', 300);
      if (isPostgresRunning) {
        try {
          const testClient = postgres(env.DATABASE_URL, {
            max: 10,
            connect_timeout: 2,
            onnotice: () => {}
          });
          await testClient`SELECT 1`;
          clientInstance = testClient;
          dbInstance = drizzle(clientInstance, { schema });
          isEmbedded = false;
          return { db: dbInstance, isEmbedded };
        } catch {
          // Fall through to PGlite
        }
      }
    }
  }

  // Use embedded persistent PostgreSQL (PGlite)
  const { PGlite } = await import('@electric-sql/pglite');
  const { drizzle: drizzlePglite } = await import('drizzle-orm/pglite');

  const isTest = process.env['VITEST'] === 'true' || process.env['NODE_ENV'] === 'test';

  if (isTest) {
    // In-memory PGlite instance for tests to prevent process lock contention
    const pglite = new PGlite();
    clientInstance = pglite;
    dbInstance = drizzlePglite(pglite, { schema });
    isEmbedded = true;
    return { db: dbInstance, isEmbedded };
  }

  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const dataDir = path.resolve(currentDir, '../../data/pg_data');
  fs.mkdirSync(dataDir, { recursive: true });

  const pglite = new PGlite(dataDir);
  clientInstance = pglite;
  dbInstance = drizzlePglite(pglite, { schema });
  isEmbedded = true;
  return { db: dbInstance, isEmbedded };
}

/**
 * Runs DDL statements to ensure all enums and tables exist in the database.
 */
export async function initDatabase(_db?: any) {
  const ddlStatements = [
    // Create Enums if not exist
    `CREATE TYPE role AS ENUM ('ADMIN', 'MANAGER', 'CLERK');`,
    `CREATE TYPE payment_status AS ENUM ('PAID', 'PARTIALLY_PAID', 'UNPAID', 'VOID');`,
    `CREATE TYPE item_status AS ENUM ('IN_STOCK', 'SOLD', 'RETURNED_TO_VAULT', 'MELTED');`,
    `CREATE TYPE metal AS ENUM ('GOLD', 'SILVER', 'PLATINUM');`,
    `CREATE TYPE payment_mode AS ENUM ('CASH', 'UPI', 'CARD_DEBIT', 'CARD_CREDIT', 'BANK_TRANSFER', 'OLD_GOLD_EXCHANGE', 'CUSTOMER_LEDGER_CREDIT');`,
    `CREATE TYPE making_charge_type AS ENUM ('PER_GRAM', 'PERCENTAGE', 'FLAT');`,
    `CREATE TYPE return_destination AS ENUM ('BACK_TO_STOCK', 'MELT_VAULT');`,

    // 1. Shops Table
    `CREATE TABLE IF NOT EXISTS shops (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(150) NOT NULL,
      code VARCHAR(20) NOT NULL UNIQUE,
      address TEXT NOT NULL,
      phone VARCHAR(25),
      email VARCHAR(150),
      gstin VARCHAR(15),
      tax_status VARCHAR(30) DEFAULT 'GST_REGISTERED' NOT NULL,
      default_tax_percent NUMERIC(5, 2) DEFAULT 3.00 NOT NULL,
      invoice_prefix VARCHAR(10) DEFAULT 'KJ' NOT NULL,
      terms_and_conditions TEXT,
      logo_url TEXT,
      owner_pin_hash TEXT,
      invoice_template JSONB,
      last_backup_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
    );`,
    `ALTER TABLE shops ADD COLUMN IF NOT EXISTS default_tax_percent NUMERIC(5, 2) DEFAULT 3.00;`,
    `ALTER TABLE shops ADD COLUMN IF NOT EXISTS invoice_prefix VARCHAR(10) DEFAULT 'KJ';`,
    `ALTER TABLE shops ADD COLUMN IF NOT EXISTS terms_and_conditions TEXT;`,
    `ALTER TABLE shops ADD COLUMN IF NOT EXISTS logo_url TEXT;`,
    `ALTER TABLE shops ADD COLUMN IF NOT EXISTS owner_pin_hash TEXT;`,
    `ALTER TABLE shops ADD COLUMN IF NOT EXISTS invoice_template JSONB;`,
    `ALTER TABLE shops ADD COLUMN IF NOT EXISTS last_backup_at TIMESTAMPTZ;`,

    // 2. Users Table
    `CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      shop_id UUID NOT NULL REFERENCES shops(id),
      name VARCHAR(100) NOT NULL,
      email VARCHAR(150) NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      pin_hash TEXT,
      role role DEFAULT 'CLERK' NOT NULL,
      is_active BOOLEAN DEFAULT true NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
    );`,

    // 3. Sessions Table
    `CREATE TABLE IF NOT EXISTS sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      shop_id UUID NOT NULL REFERENCES shops(id),
      token_hash VARCHAR(128) NOT NULL UNIQUE,
      expires_at TIMESTAMPTZ NOT NULL,
      revoked BOOLEAN DEFAULT false NOT NULL,
      ip_address VARCHAR(50),
      user_agent TEXT,
      last_active_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
    );`,

    // 4. Categories Table
    `CREATE TABLE IF NOT EXISTS categories (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      shop_id UUID NOT NULL REFERENCES shops(id),
      name VARCHAR(100) NOT NULL,
      code VARCHAR(30) NOT NULL,
      default_making_type making_charge_type DEFAULT 'PER_GRAM' NOT NULL,
      default_making_value NUMERIC(12, 2) DEFAULT 450.00 NOT NULL,
      default_wastage_pct NUMERIC(5, 2) DEFAULT 1.50 NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
      CONSTRAINT unq_categories_shop_code UNIQUE (shop_id, code)
    );`,

    // 5. Rate Definitions Table (Authoritative Showroom Rate Master)
    `CREATE TABLE IF NOT EXISTS rate_definitions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      shop_id UUID NOT NULL REFERENCES shops(id),
      metal VARCHAR(50) NOT NULL,
      purity VARCHAR(50) NOT NULL,
      fineness INTEGER NOT NULL,
      current_rate NUMERIC(12, 2) NOT NULL,
      is_active BOOLEAN DEFAULT true NOT NULL,
      sort_order INTEGER DEFAULT 0 NOT NULL,
      effective_from TIMESTAMPTZ DEFAULT NOW() NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
      CONSTRAINT unq_rate_defs_shop_metal_purity UNIQUE (shop_id, metal, purity)
    );`,

    // 6. Rate History Table (Immutable Rate Master Audit Log)
    `CREATE TABLE IF NOT EXISTS rate_history (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      shop_id UUID NOT NULL REFERENCES shops(id),
      rate_definition_id UUID REFERENCES rate_definitions(id),
      metal VARCHAR(50) NOT NULL,
      purity VARCHAR(50) NOT NULL,
      fineness INTEGER,
      previous_rate NUMERIC(12, 2),
      new_rate NUMERIC(12, 2) NOT NULL,
      action VARCHAR(50) NOT NULL,
      changed_by UUID NOT NULL REFERENCES users(id),
      created_by_name VARCHAR(100),
      change_reason TEXT,
      effective_from TIMESTAMPTZ DEFAULT NOW() NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
    );`,
    `ALTER TABLE rate_history ADD COLUMN IF NOT EXISTS change_reason TEXT;`,

    // 7. Canonical jewellery_items Table
    `CREATE TABLE IF NOT EXISTS jewellery_items (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      shop_id UUID NOT NULL REFERENCES shops(id),
      category_id UUID REFERENCES categories(id),
      rate_definition_id UUID REFERENCES rate_definitions(id),
      item_code VARCHAR(50) NOT NULL UNIQUE,
      category VARCHAR(50) NOT NULL,
      design_title VARCHAR(150) NOT NULL,
      metal VARCHAR(50) DEFAULT 'GOLD' NOT NULL,
      purity VARCHAR(50) NOT NULL,
      fineness INTEGER,
      gross_weight NUMERIC(12, 3) NOT NULL,
      stone_weight NUMERIC(12, 3) DEFAULT 0.000 NOT NULL,
      net_weight NUMERIC(12, 3) NOT NULL,
      huid VARCHAR(10),
      hallmark_verified BOOLEAN DEFAULT true NOT NULL,
      making_charge_type making_charge_type DEFAULT 'PER_GRAM' NOT NULL,
      making_charge_value NUMERIC(12, 2) DEFAULT 0.00 NOT NULL,
      wastage_pct NUMERIC(5, 2) DEFAULT 0.00 NOT NULL,
      stone_value NUMERIC(14, 2) DEFAULT 0.00 NOT NULL,
      status item_status DEFAULT 'IN_STOCK' NOT NULL,
      notes TEXT,
      image_url TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
    );`,
    `ALTER TABLE jewellery_items ADD COLUMN IF NOT EXISTS rate_definition_id UUID REFERENCES rate_definitions(id);`,
    `ALTER TABLE jewellery_items ADD COLUMN IF NOT EXISTS fineness INTEGER;`,

    // 8. Gold Rates Table (Historical daily broadcast snapshot archive)
    `CREATE TABLE IF NOT EXISTS gold_rates (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      shop_id UUID NOT NULL REFERENCES shops(id),
      rate_24k NUMERIC(12, 2) NOT NULL,
      rate_22k NUMERIC(12, 2) NOT NULL,
      rate_18k NUMERIC(12, 2) NOT NULL,
      rate_silver NUMERIC(12, 2) NOT NULL,
      rate_platinum NUMERIC(12, 2),
      effective_from TIMESTAMPTZ DEFAULT NOW() NOT NULL,
      created_by UUID NOT NULL REFERENCES users(id),
      created_by_name VARCHAR(100),
      created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
    );`,

    // 7. Pricing Rules Table
    `CREATE TABLE IF NOT EXISTS pricing_rules (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      shop_id UUID NOT NULL REFERENCES shops(id),
      metal metal NOT NULL,
      purity VARCHAR(20) NOT NULL,
      making_charge_type making_charge_type DEFAULT 'PER_GRAM' NOT NULL,
      default_making_value NUMERIC(12, 2) NOT NULL,
      default_wastage_pct NUMERIC(5, 2) DEFAULT 0.00 NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
      CONSTRAINT unq_pricing_rules_metal_purity UNIQUE (shop_id, metal, purity)
    );`,

    // 8. Customers Table
    `CREATE TABLE IF NOT EXISTS customers (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      shop_id UUID NOT NULL REFERENCES shops(id),
      name VARCHAR(150) NOT NULL,
      mobile VARCHAR(20) NOT NULL,
      email VARCHAR(150),
      pan VARCHAR(15),
      address TEXT,
      city VARCHAR(100),
      state_code VARCHAR(10),
      gstin VARCHAR(15),
      ledger_balance NUMERIC(14, 2) DEFAULT 0.00 NOT NULL,
      total_purchases NUMERIC(14, 2) DEFAULT 0.00 NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
      CONSTRAINT unq_customers_shop_mobile UNIQUE (shop_id, mobile)
    );`,

    // 9. Customer Ledger Entries Table
    `CREATE TABLE IF NOT EXISTS customer_ledger_entries (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      shop_id UUID NOT NULL REFERENCES shops(id),
      customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      date TIMESTAMPTZ DEFAULT NOW() NOT NULL,
      type VARCHAR(50) NOT NULL,
      reference_no VARCHAR(100) NOT NULL,
      description TEXT NOT NULL,
      debit NUMERIC(14, 2) DEFAULT 0.00 NOT NULL,
      credit NUMERIC(14, 2) DEFAULT 0.00 NOT NULL,
      running_balance NUMERIC(14, 2) NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
    );`,

    // 10. Invoices Table
    `CREATE TABLE IF NOT EXISTS invoices (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      shop_id UUID NOT NULL REFERENCES shops(id),
      invoice_number VARCHAR(50) NOT NULL UNIQUE,
      customer_id UUID REFERENCES customers(id),
      customer_name VARCHAR(150) NOT NULL,
      customer_mobile VARCHAR(20) NOT NULL,
      customer_pan VARCHAR(15),
      customer_address TEXT,
      customer_gstin VARCHAR(15),
      subtotal_metal NUMERIC(14, 2) NOT NULL,
      making_charges_total NUMERIC(14, 2) DEFAULT 0.00 NOT NULL,
      wastage_value_total NUMERIC(14, 2) DEFAULT 0.00 NOT NULL,
      stone_value_total NUMERIC(14, 2) DEFAULT 0.00 NOT NULL,
      discount_total NUMERIC(14, 2) DEFAULT 0.00 NOT NULL,
      old_gold_deduction_total NUMERIC(14, 2) DEFAULT 0.00 NOT NULL,
      taxable_amount NUMERIC(14, 2) NOT NULL,
      tax_percent NUMERIC(5, 2) DEFAULT 3.00 NOT NULL,
      cgst_amount NUMERIC(14, 2) DEFAULT 0.00 NOT NULL,
      sgst_amount NUMERIC(14, 2) DEFAULT 0.00 NOT NULL,
      igst_amount NUMERIC(14, 2) DEFAULT 0.00 NOT NULL,
      total_tax_amount NUMERIC(14, 2) NOT NULL,
      round_off NUMERIC(6, 2) DEFAULT 0.00 NOT NULL,
      grand_total NUMERIC(14, 2) NOT NULL,
      amount_paid NUMERIC(14, 2) DEFAULT 0.00 NOT NULL,
      balance_due NUMERIC(14, 2) DEFAULT 0.00 NOT NULL,
      payment_status payment_status DEFAULT 'PAID' NOT NULL,
      created_by UUID NOT NULL REFERENCES users(id),
      created_by_name VARCHAR(100),
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
    );`,

    // 13. Invoice Items Table (Line-item historical snapshot with applied & master rates)
    `CREATE TABLE IF NOT EXISTS invoice_items (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
      item_id UUID REFERENCES jewellery_items(id),
      item_code VARCHAR(50) NOT NULL,
      design_title VARCHAR(150) NOT NULL,
      metal VARCHAR(50) NOT NULL,
      purity VARCHAR(50) NOT NULL,
      fineness INTEGER,
      gross_weight NUMERIC(12, 3) NOT NULL,
      stone_weight NUMERIC(12, 3) DEFAULT 0.000 NOT NULL,
      net_weight NUMERIC(12, 3) NOT NULL,
      huid VARCHAR(10),
      board_rate NUMERIC(12, 2) NOT NULL,
      master_rate NUMERIC(12, 2),
      is_rate_overridden BOOLEAN DEFAULT false NOT NULL,
      override_reason TEXT,
      metal_value NUMERIC(14, 2) NOT NULL,
      making_charge_type making_charge_type DEFAULT 'PER_GRAM' NOT NULL,
      making_charges NUMERIC(14, 2) DEFAULT 0.00 NOT NULL,
      wastage_pct NUMERIC(5, 2) DEFAULT 0.00 NOT NULL,
      wastage_value NUMERIC(14, 2) DEFAULT 0.00 NOT NULL,
      stone_value NUMERIC(14, 2) DEFAULT 0.00 NOT NULL,
      discount NUMERIC(14, 2) DEFAULT 0.00 NOT NULL,
      taxable_amount NUMERIC(14, 2) NOT NULL,
      tax_percent NUMERIC(5, 2) DEFAULT 3.00 NOT NULL,
      tax_amount NUMERIC(14, 2) NOT NULL,
      final_amount NUMERIC(14, 2) NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
    );`,
    `ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS fineness INTEGER;`,
    `ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS master_rate NUMERIC(12, 2);`,
    `ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS is_rate_overridden BOOLEAN DEFAULT false NOT NULL;`,
    `ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS override_reason TEXT;`,

    // 12. Payments Table
    `CREATE TABLE IF NOT EXISTS payments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      shop_id UUID NOT NULL REFERENCES shops(id),
      invoice_id UUID REFERENCES invoices(id),
      customer_id UUID REFERENCES customers(id),
      customer_name VARCHAR(150),
      amount NUMERIC(14, 2) NOT NULL,
      mode payment_mode NOT NULL,
      reference_no VARCHAR(100),
      notes TEXT,
      created_by UUID NOT NULL REFERENCES users(id),
      created_by_name VARCHAR(100),
      created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
    );`,

    // 13. Old Gold Transactions Table
    `CREATE TABLE IF NOT EXISTS old_gold_transactions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      shop_id UUID NOT NULL REFERENCES shops(id),
      transaction_number VARCHAR(50) NOT NULL UNIQUE,
      customer_id UUID REFERENCES customers(id),
      customer_name VARCHAR(150) NOT NULL,
      customer_mobile VARCHAR(20) NOT NULL,
      metal metal DEFAULT 'GOLD' NOT NULL,
      gross_weight NUMERIC(12, 3) NOT NULL,
      dust_stone_deduction NUMERIC(12, 3) DEFAULT 0.000 NOT NULL,
      net_scrap_weight NUMERIC(12, 3) NOT NULL,
      tested_purity_percent NUMERIC(5, 2) NOT NULL,
      fine_weight NUMERIC(12, 3) NOT NULL,
      buyback_rate_per_gram NUMERIC(12, 2) NOT NULL,
      total_valuation NUMERIC(14, 2) NOT NULL,
      settlement_type VARCHAR(50) DEFAULT 'CART_EXCHANGE' NOT NULL,
      invoice_id UUID REFERENCES invoices(id),
      created_by UUID NOT NULL REFERENCES users(id),
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
    );`,

    // 14. Returns Table
    `CREATE TABLE IF NOT EXISTS returns (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      shop_id UUID NOT NULL REFERENCES shops(id),
      return_number VARCHAR(50) NOT NULL UNIQUE,
      original_invoice_id UUID NOT NULL REFERENCES invoices(id),
      original_invoice_number VARCHAR(50) NOT NULL,
      item_id UUID NOT NULL REFERENCES jewellery_items(id),
      item_code VARCHAR(50) NOT NULL,
      item_title VARCHAR(150) NOT NULL,
      customer_name VARCHAR(150) NOT NULL,
      return_reason TEXT NOT NULL,
      refund_amount NUMERIC(14, 2) NOT NULL,
      deduction_amount NUMERIC(14, 2) DEFAULT 0.00 NOT NULL,
      net_refund_amount NUMERIC(14, 2) NOT NULL,
      restock_destination return_destination DEFAULT 'BACK_TO_STOCK' NOT NULL,
      authorized_by UUID NOT NULL REFERENCES users(id),
      authorized_by_name VARCHAR(100),
      created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
    );`,

    // 15. Return Items Table
    `CREATE TABLE IF NOT EXISTS return_items (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      return_id UUID NOT NULL REFERENCES returns(id) ON DELETE CASCADE,
      item_id UUID NOT NULL REFERENCES jewellery_items(id),
      item_code VARCHAR(50) NOT NULL,
      refund_amount NUMERIC(14, 2) NOT NULL,
      deduction_amount NUMERIC(14, 2) DEFAULT 0.00 NOT NULL,
      net_amount NUMERIC(14, 2) NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
    );`,

    // 16. Label Jobs Table
    `CREATE TABLE IF NOT EXISTS label_jobs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      shop_id UUID NOT NULL REFERENCES shops(id),
      item_ids JSONB NOT NULL,
      format VARCHAR(30) DEFAULT 'DUMBBELL' NOT NULL,
      status VARCHAR(30) DEFAULT 'PENDING' NOT NULL,
      printed_by UUID REFERENCES users(id),
      printed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
    );`,

    // 17. Audit Logs Table
    `CREATE TABLE IF NOT EXISTS audit_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      shop_id UUID NOT NULL REFERENCES shops(id),
      actor_id UUID NOT NULL REFERENCES users(id),
      actor_name VARCHAR(100),
      actor_role VARCHAR(50),
      action VARCHAR(100) NOT NULL,
      entity_name VARCHAR(100) NOT NULL,
      entity_id VARCHAR(100) NOT NULL,
      state_diff JSONB,
      ip_address VARCHAR(50),
      created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
    );`,

    // 18. Idempotency Keys Table
    `CREATE TABLE IF NOT EXISTS idempotency_keys (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      key VARCHAR(255) NOT NULL,
      shop_id UUID NOT NULL REFERENCES shops(id),
      endpoint VARCHAR(255) NOT NULL,
      request_hash VARCHAR(128) NOT NULL,
      response_status_code NUMERIC(4, 0),
      response_body JSONB,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
      CONSTRAINT unq_idempotency_shop_key UNIQUE (shop_id, key)
    );`,

    // 19. Label Templates Table
    `CREATE TABLE IF NOT EXISTS label_templates (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      shop_id UUID NOT NULL REFERENCES shops(id),
      name VARCHAR(100) DEFAULT 'Standard Jewellery Tag' NOT NULL,
      preset VARCHAR(50) DEFAULT 'SMALL_RECTANGLE' NOT NULL,
      width_mm NUMERIC(6, 2) DEFAULT 50.00 NOT NULL,
      height_mm NUMERIC(6, 2) DEFAULT 25.00 NOT NULL,
      config JSONB NOT NULL,
      is_default BOOLEAN DEFAULT true NOT NULL,
      created_by UUID REFERENCES users(id),
      updated_by UUID REFERENCES users(id),
      created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
    );`,

    // 20. Deleted Records Tombstone Table
    `CREATE TABLE IF NOT EXISTS deleted_records (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      shop_id UUID NOT NULL REFERENCES shops(id),
      entity_name VARCHAR(100) NOT NULL,
      entity_id VARCHAR(100) NOT NULL,
      deleted_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
    );`,

    // 21. Item Images Table
    `CREATE TABLE IF NOT EXISTS item_images (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      shop_id UUID NOT NULL REFERENCES shops(id),
      item_id UUID NOT NULL REFERENCES jewellery_items(id) ON DELETE CASCADE,
      storage_path TEXT NOT NULL,
      image_url TEXT NOT NULL,
      is_primary BOOLEAN DEFAULT false NOT NULL,
      label VARCHAR(50) DEFAULT 'Main' NOT NULL,
      sort_order INTEGER DEFAULT 0 NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
    );`,

    // 22. Suppliers Table
    `CREATE TABLE IF NOT EXISTS suppliers (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      shop_id UUID NOT NULL REFERENCES shops(id),
      name VARCHAR(150) NOT NULL,
      supplier_code VARCHAR(50) NOT NULL,
      mobile VARCHAR(20) NOT NULL,
      email VARCHAR(150),
      pan VARCHAR(15),
      gstin VARCHAR(15),
      address TEXT,
      city VARCHAR(100),
      state VARCHAR(100),
      state_code VARCHAR(10),
      payment_terms_days INTEGER DEFAULT 30 NOT NULL,
      opening_balance NUMERIC(14, 2) DEFAULT 0.00 NOT NULL,
      current_balance NUMERIC(14, 2) DEFAULT 0.00 NOT NULL,
      is_active BOOLEAN DEFAULT true NOT NULL,
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
      CONSTRAINT unq_suppliers_shop_code UNIQUE (shop_id, supplier_code)
    );`,

    // 23. Purchases Table
    `CREATE TABLE IF NOT EXISTS purchases (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      shop_id UUID NOT NULL REFERENCES shops(id),
      supplier_id UUID NOT NULL REFERENCES suppliers(id),
      supplier_name VARCHAR(150) NOT NULL,
      supplier_gstin VARCHAR(15),
      supplier_state_code VARCHAR(10),
      purchase_number VARCHAR(50) NOT NULL,
      supplier_invoice_number VARCHAR(100),
      purchase_date TIMESTAMPTZ DEFAULT NOW() NOT NULL,
      metal_total_weight NUMERIC(12, 3) DEFAULT 0.000 NOT NULL,
      pure_weight_total NUMERIC(12, 3) DEFAULT 0.000 NOT NULL,
      subtotal_metal NUMERIC(14, 2) DEFAULT 0.00 NOT NULL,
      making_charges_total NUMERIC(14, 2) DEFAULT 0.00 NOT NULL,
      wastage_value_total NUMERIC(14, 2) DEFAULT 0.00 NOT NULL,
      stone_value_total NUMERIC(14, 2) DEFAULT 0.00 NOT NULL,
      other_charges NUMERIC(14, 2) DEFAULT 0.00 NOT NULL,
      discount_total NUMERIC(14, 2) DEFAULT 0.00 NOT NULL,
      taxable_amount NUMERIC(14, 2) NOT NULL,
      tax_percent NUMERIC(5, 2) DEFAULT 3.00 NOT NULL,
      cgst_amount NUMERIC(14, 2) DEFAULT 0.00 NOT NULL,
      sgst_amount NUMERIC(14, 2) DEFAULT 0.00 NOT NULL,
      igst_amount NUMERIC(14, 2) DEFAULT 0.00 NOT NULL,
      total_tax_amount NUMERIC(14, 2) NOT NULL,
      round_off NUMERIC(6, 2) DEFAULT 0.00 NOT NULL,
      grand_total NUMERIC(14, 2) NOT NULL,
      amount_paid NUMERIC(14, 2) DEFAULT 0.00 NOT NULL,
      balance_due NUMERIC(14, 2) DEFAULT 0.00 NOT NULL,
      payment_status payment_status DEFAULT 'UNPAID' NOT NULL,
      created_by UUID NOT NULL REFERENCES users(id),
      created_by_name VARCHAR(100),
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
      CONSTRAINT unq_purchases_shop_number UNIQUE (shop_id, purchase_number)
    );`,

    // 24. Purchase Items Table
    `CREATE TABLE IF NOT EXISTS purchase_items (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      purchase_id UUID NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
      item_id UUID REFERENCES jewellery_items(id),
      item_code VARCHAR(50) NOT NULL,
      category VARCHAR(50) NOT NULL,
      design_title VARCHAR(150) NOT NULL,
      metal VARCHAR(50) DEFAULT 'GOLD' NOT NULL,
      purity VARCHAR(50) NOT NULL,
      fineness INTEGER,
      gross_weight NUMERIC(12, 3) NOT NULL,
      stone_weight NUMERIC(12, 3) DEFAULT 0.000 NOT NULL,
      net_weight NUMERIC(12, 3) NOT NULL,
      pure_weight NUMERIC(12, 3) DEFAULT 0.000 NOT NULL,
      purchase_rate NUMERIC(12, 2) NOT NULL,
      benchmark_rate NUMERIC(12, 2),
      metal_cost NUMERIC(14, 2) NOT NULL,
      making_charge_type making_charge_type DEFAULT 'PER_GRAM' NOT NULL,
      making_rate NUMERIC(12, 2) DEFAULT 0.00 NOT NULL,
      making_cost NUMERIC(14, 2) DEFAULT 0.00 NOT NULL,
      wastage_pct NUMERIC(5, 2) DEFAULT 0.00 NOT NULL,
      wastage_value NUMERIC(14, 2) DEFAULT 0.00 NOT NULL,
      stone_value NUMERIC(14, 2) DEFAULT 0.00 NOT NULL,
      taxable_amount NUMERIC(14, 2) NOT NULL,
      tax_amount NUMERIC(14, 2) DEFAULT 0.00 NOT NULL,
      final_amount NUMERIC(14, 2) NOT NULL,
      huid VARCHAR(10),
      auto_create_stock BOOLEAN DEFAULT true NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
    );`,

    // 25. Supplier Ledger Entries Table
    `CREATE TABLE IF NOT EXISTS supplier_ledger_entries (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      shop_id UUID NOT NULL REFERENCES shops(id),
      supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
      date TIMESTAMPTZ DEFAULT NOW() NOT NULL,
      type VARCHAR(50) NOT NULL,
      reference_no VARCHAR(100) NOT NULL,
      description TEXT NOT NULL,
      debit NUMERIC(14, 2) DEFAULT 0.00 NOT NULL,
      credit NUMERIC(14, 2) DEFAULT 0.00 NOT NULL,
      running_balance NUMERIC(14, 2) NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
    );`,

    // 26. Purchase Payments Table
    `CREATE TABLE IF NOT EXISTS purchase_payments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      shop_id UUID NOT NULL REFERENCES shops(id),
      purchase_id UUID REFERENCES purchases(id),
      supplier_id UUID NOT NULL REFERENCES suppliers(id),
      amount NUMERIC(14, 2) NOT NULL,
      mode payment_mode NOT NULL,
      reference_no VARCHAR(100),
      notes TEXT,
      created_by UUID NOT NULL REFERENCES users(id),
      created_by_name VARCHAR(100),
      created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
    );`,

    // 27. Purchase Returns Table
    `CREATE TABLE IF NOT EXISTS purchase_returns (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      shop_id UUID NOT NULL REFERENCES shops(id),
      return_number VARCHAR(50) NOT NULL,
      original_purchase_id UUID REFERENCES purchases(id),
      supplier_id UUID NOT NULL REFERENCES suppliers(id),
      supplier_name VARCHAR(150) NOT NULL,
      total_refund_amount NUMERIC(14, 2) NOT NULL,
      reason TEXT NOT NULL,
      authorized_by UUID NOT NULL REFERENCES users(id),
      authorized_by_name VARCHAR(100),
      created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
      CONSTRAINT unq_purchase_returns_number UNIQUE (shop_id, return_number)
    );`,

    // 28. Purchase Return Items Table
    `CREATE TABLE IF NOT EXISTS purchase_return_items (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      purchase_return_id UUID NOT NULL REFERENCES purchase_returns(id) ON DELETE CASCADE,
      item_id UUID REFERENCES jewellery_items(id),
      item_code VARCHAR(50) NOT NULL,
      gross_weight NUMERIC(12, 3) NOT NULL,
      net_weight NUMERIC(12, 3) NOT NULL,
      return_rate NUMERIC(12, 2) NOT NULL,
      return_amount NUMERIC(14, 2) NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
    );`,

    // Add nullable provenance fields to jewellery_items
    `ALTER TABLE jewellery_items ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES suppliers(id);`,
    `ALTER TABLE jewellery_items ADD COLUMN IF NOT EXISTS purchase_id UUID REFERENCES purchases(id);`,
    `ALTER TABLE jewellery_items ADD COLUMN IF NOT EXISTS purchase_cost_rate NUMERIC(12, 2);`,
    `ALTER TABLE jewellery_items ADD COLUMN IF NOT EXISTS cost_metal_value NUMERIC(14, 2);`
  ];

  try {
    const combinedScript = ddlStatements.join('\n');
    if (clientInstance?.query) {
      await clientInstance.query(combinedScript);
    } else if (clientInstance?.unsafe) {
      await clientInstance.unsafe(combinedScript);
    }
  } catch {
    for (const statement of ddlStatements) {
      try {
        if (clientInstance?.query) {
          await clientInstance.query(statement);
        } else if (clientInstance?.unsafe) {
          await clientInstance.unsafe(statement);
        }
      } catch {
        // Ignore if already exists
      }
    }
  }
}
