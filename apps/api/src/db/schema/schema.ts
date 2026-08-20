import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  numeric,
  integer,
  jsonb,
  pgEnum,
  index,
  uniqueIndex
} from 'drizzle-orm/pg-core';

// PostgreSQL Enums
export const roleEnum = pgEnum('role', ['ADMIN', 'MANAGER', 'CLERK']);
export const paymentStatusEnum = pgEnum('payment_status', ['PAID', 'PARTIALLY_PAID', 'UNPAID', 'VOID']);
export const itemStatusEnum = pgEnum('item_status', ['IN_STOCK', 'SOLD', 'RETURNED_TO_VAULT', 'MELTED']);
export const metalEnum = pgEnum('metal', ['GOLD', 'SILVER', 'PLATINUM']);
export const paymentModeEnum = pgEnum('payment_mode', [
  'CASH',
  'UPI',
  'CARD_DEBIT',
  'CARD_CREDIT',
  'BANK_TRANSFER',
  'OLD_GOLD_EXCHANGE',
  'CUSTOMER_LEDGER_CREDIT'
]);
export const makingChargeTypeEnum = pgEnum('making_charge_type', ['PER_GRAM', 'PERCENTAGE', 'FLAT']);
export const returnDestinationEnum = pgEnum('return_destination', ['BACK_TO_STOCK', 'MELT_VAULT']);

// 1. Shops Table
export const shops = pgTable('shops', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 150 }).notNull(),
  code: varchar('code', { length: 20 }).notNull().unique(),
  address: text('address').notNull(),
  phone: varchar('phone', { length: 25 }),
  email: varchar('email', { length: 150 }),
  gstin: varchar('gstin', { length: 15 }),
  taxStatus: varchar('tax_status', { length: 30 }).default('GST_REGISTERED').notNull(),
  defaultTaxPercent: numeric('default_tax_percent', { precision: 5, scale: 2 }).default('3.00').notNull(),
  invoicePrefix: varchar('invoice_prefix', { length: 10 }).default('KJ').notNull(),
  termsAndConditions: text('terms_and_conditions'),
  logoUrl: text('logo_url'),
  ownerPinHash: text('owner_pin_hash'),
  invoiceTemplate: jsonb('invoice_template'),
  lastBackupAt: timestamp('last_backup_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
});

// 2. Users Table (Staff Accounts)
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  shopId: uuid('shop_id').references(() => shops.id).notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  email: varchar('email', { length: 150 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  pinHash: text('pin_hash'),
  role: roleEnum('role').default('CLERK').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
}, (table) => ({
  emailIdx: index('idx_users_email').on(table.email),
  shopIdx: index('idx_users_shop').on(table.shopId)
}));

// 3. Sessions Table (Active Authentication Sessions)
export const sessions = pgTable('sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  shopId: uuid('shop_id').references(() => shops.id).notNull(),
  tokenHash: varchar('token_hash', { length: 128 }).notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  revoked: boolean('revoked').default(false).notNull(),
  ipAddress: varchar('ip_address', { length: 50 }),
  userAgent: text('user_agent'),
  lastActiveAt: timestamp('last_active_at', { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
}, (table) => ({
  tokenIdx: index('idx_sessions_token').on(table.tokenHash),
  userExpiresIdx: index('idx_sessions_user_expires').on(table.userId, table.expiresAt)
}));

// 4. Categories Table
export const categories = pgTable('categories', {
  id: uuid('id').defaultRandom().primaryKey(),
  shopId: uuid('shop_id').references(() => shops.id).notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  code: varchar('code', { length: 30 }).notNull(),
  defaultMakingType: makingChargeTypeEnum('default_making_type').default('PER_GRAM').notNull(),
  defaultMakingValue: numeric('default_making_value', { precision: 12, scale: 2 }).default('450.00').notNull(),
  defaultWastagePct: numeric('default_wastage_pct', { precision: 5, scale: 2 }).default('1.50').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
}, (table) => ({
  shopCodeIdx: uniqueIndex('idx_categories_shop_code').on(table.shopId, table.code)
}));

// 5. Rate Definitions Table (Authoritative Showroom Rate Master)
export const rateDefinitions = pgTable('rate_definitions', {
  id: uuid('id').defaultRandom().primaryKey(),
  shopId: uuid('shop_id').references(() => shops.id).notNull(),
  metal: varchar('metal', { length: 50 }).notNull(),
  purity: varchar('purity', { length: 50 }).notNull(),
  fineness: integer('fineness').notNull(),
  currentRate: numeric('current_rate', { precision: 12, scale: 2 }).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  sortOrder: integer('sort_order').default(0).notNull(),
  effectiveFrom: timestamp('effective_from', { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
}, (table) => ({
  shopMetalPurityIdx: uniqueIndex('idx_rate_defs_shop_metal_purity').on(table.shopId, table.metal, table.purity),
  shopActiveIdx: index('idx_rate_defs_shop_active').on(table.shopId, table.isActive)
}));

// 6. Rate History Table (Immutable Rate Master change log)
export const rateHistory = pgTable('rate_history', {
  id: uuid('id').defaultRandom().primaryKey(),
  shopId: uuid('shop_id').references(() => shops.id).notNull(),
  rateDefinitionId: uuid('rate_definition_id').references(() => rateDefinitions.id),
  metal: varchar('metal', { length: 50 }).notNull(),
  purity: varchar('purity', { length: 50 }).notNull(),
  fineness: integer('fineness'),
  previousRate: numeric('previous_rate', { precision: 12, scale: 2 }),
  newRate: numeric('new_rate', { precision: 12, scale: 2 }).notNull(),
  action: varchar('action', { length: 50 }).notNull(), // 'RATE_CREATED', 'RATE_UPDATED', 'RATE_ACTIVATED', 'RATE_DEACTIVATED', 'RATE_PUBLISHED'
  changedBy: uuid('changed_by').references(() => users.id).notNull(),
  changedByName: varchar('created_by_name', { length: 100 }),
  effectiveFrom: timestamp('effective_from', { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
}, (table) => ({
  shopRateDefIdx: index('idx_rate_history_shop_rate_def').on(table.shopId, table.rateDefinitionId),
  shopEffectiveIdx: index('idx_rate_history_shop_effective').on(table.shopId, table.effectiveFrom)
}));

// 7. Canonical Jewellery Items Inventory Table
export const jewelleryItems = pgTable('jewellery_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  shopId: uuid('shop_id').references(() => shops.id).notNull(),
  categoryId: uuid('category_id').references(() => categories.id),
  rateDefinitionId: uuid('rate_definition_id').references(() => rateDefinitions.id),
  itemCode: varchar('item_code', { length: 50 }).notNull().unique(),
  category: varchar('category', { length: 50 }).notNull(),
  designTitle: varchar('design_title', { length: 150 }).notNull(),
  metal: varchar('metal', { length: 50 }).default('GOLD').notNull(),
  purity: varchar('purity', { length: 50 }).notNull(),
  fineness: integer('fineness'),
  grossWeight: numeric('gross_weight', { precision: 12, scale: 3 }).notNull(),
  stoneWeight: numeric('stone_weight', { precision: 12, scale: 3 }).default('0.000').notNull(),
  netWeight: numeric('net_weight', { precision: 12, scale: 3 }).notNull(),
  huid: varchar('huid', { length: 10 }),
  hallmarkVerified: boolean('hallmark_verified').default(true).notNull(),
  makingChargeType: makingChargeTypeEnum('making_charge_type').default('PER_GRAM').notNull(),
  makingChargeValue: numeric('making_charge_value', { precision: 12, scale: 2 }).default('0.00').notNull(),
  wastagePct: numeric('wastage_pct', { precision: 5, scale: 2 }).default('0.00').notNull(),
  stoneValue: numeric('stone_value', { precision: 14, scale: 2 }).default('0.00').notNull(),
  status: itemStatusEnum('status').default('IN_STOCK').notNull(),
  notes: text('notes'),
  imageUrl: text('image_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
}, (table) => ({
  codeIdx: index('idx_items_code').on(table.itemCode),
  statusIdx: index('idx_items_status').on(table.shopId, table.status),
  huidIdx: index('idx_items_huid').on(table.huid),
  rateDefIdx: index('idx_items_rate_def').on(table.rateDefinitionId)
}));

// Export alias for backward-compatibility during refactor
export const items = jewelleryItems;

// 8. Gold Rates Table (Historical daily broadcast snapshot archive)
export const goldRates = pgTable('gold_rates', {
  id: uuid('id').defaultRandom().primaryKey(),
  shopId: uuid('shop_id').references(() => shops.id).notNull(),
  rate24k: numeric('rate_24k', { precision: 12, scale: 2 }).notNull(),
  rate22k: numeric('rate_22k', { precision: 12, scale: 2 }).notNull(),
  rate18k: numeric('rate_18k', { precision: 12, scale: 2 }).notNull(),
  rateSilver: numeric('rate_silver', { precision: 12, scale: 2 }).notNull(),
  ratePlatinum: numeric('rate_platinum', { precision: 12, scale: 2 }),
  effectiveFrom: timestamp('effective_from', { withTimezone: true }).defaultNow().notNull(),
  createdBy: uuid('created_by').references(() => users.id).notNull(),
  createdByName: varchar('created_by_name', { length: 100 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
}, (table) => ({
  shopEffectiveIdx: index('idx_rates_shop_effective').on(table.shopId, table.effectiveFrom)
}));

// 9. Pricing Rules Table
export const pricingRules = pgTable('pricing_rules', {
  id: uuid('id').defaultRandom().primaryKey(),
  shopId: uuid('shop_id').references(() => shops.id).notNull(),
  metal: varchar('metal', { length: 50 }).notNull(),
  purity: varchar('purity', { length: 50 }).notNull(),
  makingChargeType: makingChargeTypeEnum('making_charge_type').default('PER_GRAM').notNull(),
  defaultMakingValue: numeric('default_making_value', { precision: 12, scale: 2 }).notNull(),
  defaultWastagePct: numeric('default_wastage_pct', { precision: 5, scale: 2 }).default('0.00').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
}, (table) => ({
  shopMetalPurityIdx: uniqueIndex('idx_pricing_rules_metal_purity').on(table.shopId, table.metal, table.purity)
}));

// 10. Customers Table
export const customers = pgTable('customers', {
  id: uuid('id').defaultRandom().primaryKey(),
  shopId: uuid('shop_id').references(() => shops.id).notNull(),
  name: varchar('name', { length: 150 }).notNull(),
  mobile: varchar('mobile', { length: 20 }).notNull(),
  email: varchar('email', { length: 150 }),
  pan: varchar('pan', { length: 15 }),
  address: text('address'),
  city: varchar('city', { length: 100 }),
  stateCode: varchar('state_code', { length: 10 }),
  gstin: varchar('gstin', { length: 15 }),
  ledgerBalance: numeric('ledger_balance', { precision: 14, scale: 2 }).default('0.00').notNull(),
  totalPurchases: numeric('total_purchases', { precision: 14, scale: 2 }).default('0.00').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
}, (table) => ({
  shopMobileIdx: uniqueIndex('idx_customers_shop_mobile').on(table.shopId, table.mobile),
  panIdx: index('idx_customers_pan').on(table.pan)
}));

// 11. Customer Ledger Entries (Financial source of truth)
export const customerLedgerEntries = pgTable('customer_ledger_entries', {
  id: uuid('id').defaultRandom().primaryKey(),
  shopId: uuid('shop_id').references(() => shops.id).notNull(),
  customerId: uuid('customer_id').references(() => customers.id, { onDelete: 'cascade' }).notNull(),
  date: timestamp('date', { withTimezone: true }).defaultNow().notNull(),
  type: varchar('type', { length: 50 }).notNull(),
  referenceNo: varchar('reference_no', { length: 100 }).notNull(),
  description: text('description').notNull(),
  debit: numeric('debit', { precision: 14, scale: 2 }).default('0.00').notNull(),
  credit: numeric('credit', { precision: 14, scale: 2 }).default('0.00').notNull(),
  runningBalance: numeric('running_balance', { precision: 14, scale: 2 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
}, (table) => ({
  customerDateIdx: index('idx_ledger_customer_date').on(table.customerId, table.date)
}));

// 12. Invoices Table (Immutable finalized financial records)
export const invoices = pgTable('invoices', {
  id: uuid('id').defaultRandom().primaryKey(),
  shopId: uuid('shop_id').references(() => shops.id).notNull(),
  invoiceNumber: varchar('invoice_number', { length: 50 }).notNull().unique(),
  customerId: uuid('customer_id').references(() => customers.id),
  customerName: varchar('customer_name', { length: 150 }).notNull(),
  customerMobile: varchar('customer_mobile', { length: 20 }).notNull(),
  customerPan: varchar('customer_pan', { length: 15 }),
  customerAddress: text('customer_address'),
  customerGstin: varchar('customer_gstin', { length: 15 }),
  subtotalMetal: numeric('subtotal_metal', { precision: 14, scale: 2 }).notNull(),
  makingChargesTotal: numeric('making_charges_total', { precision: 14, scale: 2 }).default('0.00').notNull(),
  wastageValueTotal: numeric('wastage_value_total', { precision: 14, scale: 2 }).default('0.00').notNull(),
  stoneValueTotal: numeric('stone_value_total', { precision: 14, scale: 2 }).default('0.00').notNull(),
  discountTotal: numeric('discount_total', { precision: 14, scale: 2 }).default('0.00').notNull(),
  oldGoldDeductionTotal: numeric('old_gold_deduction_total', { precision: 14, scale: 2 }).default('0.00').notNull(),
  taxableAmount: numeric('taxable_amount', { precision: 14, scale: 2 }).notNull(),
  taxPercent: numeric('tax_percent', { precision: 5, scale: 2 }).default('3.00').notNull(),
  cgstAmount: numeric('cgst_amount', { precision: 14, scale: 2 }).default('0.00').notNull(),
  sgstAmount: numeric('sgst_amount', { precision: 14, scale: 2 }).default('0.00').notNull(),
  igstAmount: numeric('igst_amount', { precision: 14, scale: 2 }).default('0.00').notNull(),
  totalTaxAmount: numeric('total_tax_amount', { precision: 14, scale: 2 }).notNull(),
  roundOff: numeric('round_off', { precision: 6, scale: 2 }).default('0.00').notNull(),
  grandTotal: numeric('grand_total', { precision: 14, scale: 2 }).notNull(),
  amountPaid: numeric('amount_paid', { precision: 14, scale: 2 }).default('0.00').notNull(),
  balanceDue: numeric('balance_due', { precision: 14, scale: 2 }).default('0.00').notNull(),
  paymentStatus: paymentStatusEnum('payment_status').default('PAID').notNull(),
  createdBy: uuid('created_by').references(() => users.id).notNull(),
  createdByName: varchar('created_by_name', { length: 100 }),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
}, (table) => ({
  numberIdx: index('idx_invoices_number').on(table.invoiceNumber),
  customerDateIdx: index('idx_invoices_customer_date').on(table.customerId, table.createdAt)
}));

// 13. Invoice Items Table (Line-item historical snapshot with applied & master rates)
export const invoiceItems = pgTable('invoice_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  invoiceId: uuid('invoice_id').references(() => invoices.id, { onDelete: 'cascade' }).notNull(),
  itemId: uuid('item_id').references(() => jewelleryItems.id),
  itemCode: varchar('item_code', { length: 50 }).notNull(),
  designTitle: varchar('design_title', { length: 150 }).notNull(),
  metal: varchar('metal', { length: 50 }).notNull(),
  purity: varchar('purity', { length: 50 }).notNull(),
  fineness: integer('fineness'),
  grossWeight: numeric('gross_weight', { precision: 12, scale: 3 }).notNull(),
  stoneWeight: numeric('stone_weight', { precision: 12, scale: 3 }).default('0.000').notNull(),
  netWeight: numeric('net_weight', { precision: 12, scale: 3 }).notNull(),
  huid: varchar('huid', { length: 10 }),
  boardRate: numeric('board_rate', { precision: 12, scale: 2 }).notNull(), // Applied Rate
  masterRate: numeric('master_rate', { precision: 12, scale: 2 }), // Master Rate at time of sale
  isRateOverridden: boolean('is_rate_overridden').default(false).notNull(),
  overrideReason: text('override_reason'),
  metalValue: numeric('metal_value', { precision: 14, scale: 2 }).notNull(),
  makingChargeType: makingChargeTypeEnum('making_charge_type').default('PER_GRAM').notNull(),
  makingCharges: numeric('making_charges', { precision: 14, scale: 2 }).default('0.00').notNull(),
  wastagePct: numeric('wastage_pct', { precision: 5, scale: 2 }).default('0.00').notNull(),
  wastageValue: numeric('wastage_value', { precision: 14, scale: 2 }).default('0.00').notNull(),
  stoneValue: numeric('stone_value', { precision: 14, scale: 2 }).default('0.00').notNull(),
  discount: numeric('discount', { precision: 14, scale: 2 }).default('0.00').notNull(),
  taxableAmount: numeric('taxable_amount', { precision: 14, scale: 2 }).notNull(),
  taxPercent: numeric('tax_percent', { precision: 5, scale: 2 }).default('3.00').notNull(),
  taxAmount: numeric('tax_amount', { precision: 14, scale: 2 }).notNull(),
  finalAmount: numeric('final_amount', { precision: 14, scale: 2 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
}, (table) => ({
  invoiceIdx: index('idx_invoice_items_invoice').on(table.invoiceId)
}));

// 12. Payments Table
export const payments = pgTable('payments', {
  id: uuid('id').defaultRandom().primaryKey(),
  shopId: uuid('shop_id').references(() => shops.id).notNull(),
  invoiceId: uuid('invoice_id').references(() => invoices.id),
  customerId: uuid('customer_id').references(() => customers.id),
  customerName: varchar('customer_name', { length: 150 }),
  amount: numeric('amount', { precision: 14, scale: 2 }).notNull(),
  mode: paymentModeEnum('mode').notNull(),
  referenceNo: varchar('reference_no', { length: 100 }),
  notes: text('notes'),
  createdBy: uuid('created_by').references(() => users.id).notNull(),
  createdByName: varchar('created_by_name', { length: 100 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
}, (table) => ({
  invoiceIdx: index('idx_payments_invoice').on(table.invoiceId),
  customerIdx: index('idx_payments_customer').on(table.customerId)
}));

// 13. Old Gold Transactions Table
export const oldGoldTransactions = pgTable('old_gold_transactions', {
  id: uuid('id').defaultRandom().primaryKey(),
  shopId: uuid('shop_id').references(() => shops.id).notNull(),
  transactionNumber: varchar('transaction_number', { length: 50 }).notNull().unique(),
  customerId: uuid('customer_id').references(() => customers.id),
  customerName: varchar('customer_name', { length: 150 }).notNull(),
  customerMobile: varchar('customer_mobile', { length: 20 }).notNull(),
  metal: metalEnum('metal').default('GOLD').notNull(),
  grossWeight: numeric('gross_weight', { precision: 12, scale: 3 }).notNull(),
  dustStoneDeduction: numeric('dust_stone_deduction', { precision: 12, scale: 3 }).default('0.000').notNull(),
  netScrapWeight: numeric('net_scrap_weight', { precision: 12, scale: 3 }).notNull(),
  testedPurityPercent: numeric('tested_purity_percent', { precision: 5, scale: 2 }).notNull(),
  fineWeight: numeric('fine_weight', { precision: 12, scale: 3 }).notNull(),
  buybackRatePerGram: numeric('buyback_rate_per_gram', { precision: 12, scale: 2 }).notNull(),
  totalValuation: numeric('total_valuation', { precision: 14, scale: 2 }).notNull(),
  settlementType: varchar('settlement_type', { length: 50 }).default('CART_EXCHANGE').notNull(),
  invoiceId: uuid('invoice_id').references(() => invoices.id),
  createdBy: uuid('created_by').references(() => users.id).notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
}, (table) => ({
  numberIdx: index('idx_old_gold_number').on(table.transactionNumber),
  customerIdx: index('idx_old_gold_customer').on(table.customerId)
}));

// 14. Returns & Exchange Table
export const returns = pgTable('returns', {
  id: uuid('id').defaultRandom().primaryKey(),
  shopId: uuid('shop_id').references(() => shops.id).notNull(),
  returnNumber: varchar('return_number', { length: 50 }).notNull().unique(),
  originalInvoiceId: uuid('original_invoice_id').references(() => invoices.id).notNull(),
  originalInvoiceNumber: varchar('original_invoice_number', { length: 50 }).notNull(),
  itemId: uuid('item_id').references(() => jewelleryItems.id).notNull(),
  itemCode: varchar('item_code', { length: 50 }).notNull(),
  itemTitle: varchar('item_title', { length: 150 }).notNull(),
  customerName: varchar('customer_name', { length: 150 }).notNull(),
  returnReason: text('return_reason').notNull(),
  refundAmount: numeric('refund_amount', { precision: 14, scale: 2 }).notNull(),
  deductionAmount: numeric('deduction_amount', { precision: 14, scale: 2 }).default('0.00').notNull(),
  netRefundAmount: numeric('net_refund_amount', { precision: 14, scale: 2 }).notNull(),
  restockDestination: returnDestinationEnum('restock_destination').default('BACK_TO_STOCK').notNull(),
  authorizedBy: uuid('authorized_by').references(() => users.id).notNull(),
  authorizedByName: varchar('authorized_by_name', { length: 100 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
}, (table) => ({
  numberIdx: index('idx_returns_number').on(table.returnNumber),
  invoiceIdx: index('idx_returns_invoice').on(table.originalInvoiceId)
}));

// 15. Return Items Table
export const returnItems = pgTable('return_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  returnId: uuid('return_id').references(() => returns.id, { onDelete: 'cascade' }).notNull(),
  itemId: uuid('item_id').references(() => jewelleryItems.id).notNull(),
  itemCode: varchar('item_code', { length: 50 }).notNull(),
  refundAmount: numeric('refund_amount', { precision: 14, scale: 2 }).notNull(),
  deductionAmount: numeric('deduction_amount', { precision: 14, scale: 2 }).default('0.00').notNull(),
  netAmount: numeric('net_amount', { precision: 14, scale: 2 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
});

// 16. Label Jobs Table
export const labelJobs = pgTable('label_jobs', {
  id: uuid('id').defaultRandom().primaryKey(),
  shopId: uuid('shop_id').references(() => shops.id).notNull(),
  itemIds: jsonb('item_ids').notNull(),
  format: varchar('format', { length: 30 }).default('DUMBBELL').notNull(),
  status: varchar('status', { length: 30 }).default('PENDING').notNull(),
  printedBy: uuid('printed_by').references(() => users.id),
  printedAt: timestamp('printed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
});

// 17. Audit Logs Table (Write-once immutable event trail)
export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  shopId: uuid('shop_id').references(() => shops.id).notNull(),
  actorId: uuid('actor_id').references(() => users.id).notNull(),
  actorName: varchar('actor_name', { length: 100 }),
  actorRole: varchar('actor_role', { length: 50 }),
  action: varchar('action', { length: 100 }).notNull(),
  entityName: varchar('entity_name', { length: 100 }).notNull(),
  entityId: varchar('entity_id', { length: 100 }).notNull(),
  stateDiff: jsonb('state_diff'),
  ipAddress: varchar('ip_address', { length: 50 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
}, (table) => ({
  entityIdx: index('idx_audit_entity').on(table.entityName, table.entityId),
  shopDateIdx: index('idx_audit_shop_date').on(table.shopId, table.createdAt)
}));

// 18. Idempotency Keys Table
export const idempotencyKeys = pgTable('idempotency_keys', {
  id: uuid('id').defaultRandom().primaryKey(),
  key: varchar('key', { length: 255 }).notNull(),
  shopId: uuid('shop_id').references(() => shops.id).notNull(),
  endpoint: varchar('endpoint', { length: 255 }).notNull(),
  requestHash: varchar('request_hash', { length: 128 }).notNull(),
  responseStatusCode: numeric('response_status_code', { precision: 4, scale: 0 }),
  responseBody: jsonb('response_body'),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
}, (table) => ({
  shopKeyIdx: uniqueIndex('idx_idempotency_shop_key').on(table.shopId, table.key),
  expiresIdx: index('idx_idempotency_expires').on(table.expiresAt)
}));

// 19. Label Templates Table (Visual label format customization)
export const labelTemplates = pgTable('label_templates', {
  id: uuid('id').defaultRandom().primaryKey(),
  shopId: uuid('shop_id').references(() => shops.id).notNull(),
  name: varchar('name', { length: 100 }).default('Standard Jewellery Tag').notNull(),
  preset: varchar('preset', { length: 50 }).default('SMALL_RECTANGLE').notNull(),
  widthMm: numeric('width_mm', { precision: 6, scale: 2 }).default('50.00').notNull(),
  heightMm: numeric('height_mm', { precision: 6, scale: 2 }).default('25.00').notNull(),
  config: jsonb('config').notNull(),
  isDefault: boolean('is_default').default(true).notNull(),
  createdBy: uuid('created_by').references(() => users.id),
  updatedBy: uuid('updated_by').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
}, (table) => ({
  shopIdx: index('idx_label_templates_shop').on(table.shopId),
  shopDefaultIdx: index('idx_label_templates_default').on(table.shopId, table.isDefault)
}));

// 20. Deleted Records Tombstone Table (Incremental change tracking for deletions)
export const deletedRecords = pgTable('deleted_records', {
  id: uuid('id').defaultRandom().primaryKey(),
  shopId: uuid('shop_id').references(() => shops.id).notNull(),
  entityName: varchar('entity_name', { length: 100 }).notNull(),
  entityId: varchar('entity_id', { length: 100 }).notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }).defaultNow().notNull()
}, (table) => ({
  shopDeletedIdx: index('idx_deleted_shop_date').on(table.shopId, table.deletedAt)
}));

// 21. Item Images Table (Multiple product images with primary indicator and tenant isolation)
export const itemImages = pgTable('item_images', {
  id: uuid('id').defaultRandom().primaryKey(),
  shopId: uuid('shop_id').references(() => shops.id).notNull(),
  itemId: uuid('item_id').references(() => jewelleryItems.id, { onDelete: 'cascade' }).notNull(),
  storagePath: text('storage_path').notNull(),
  imageUrl: text('image_url').notNull(),
  isPrimary: boolean('is_primary').default(false).notNull(),
  label: varchar('label', { length: 50 }).default('Main').notNull(),
  sortOrder: integer('sort_order').default(0).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
}, (table) => ({
  shopItemIdx: index('idx_item_images_shop_item').on(table.shopId, table.itemId),
  itemPrimaryIdx: index('idx_item_images_item_primary').on(table.itemId, table.isPrimary)
}));

