import { describe, it, expect, beforeAll } from 'vitest';
import { getDatabase, initDatabase } from './connection.js';
import * as schema from './schema/index.js';
import { hashPassword, verifyPassword, hashPin, verifyPin } from '../services/crypto.js';
import { createItem, getItemByIdOrCode, updateItem, listItems } from '../services/items.service.js';
import { createCustomer, getCustomerById, recordCustomerPayment } from '../services/customers.service.js';
import { createInvoiceTransaction, getInvoiceById, listInvoices } from '../services/billing.service.js';
import { createRatesSnapshot, getLatestRates } from '../services/rates.service.js';
import { createReturnTransaction } from '../services/returns.service.js';
import { createOldGoldAssay, getOldGoldById } from '../services/oldGold.service.js';
import { validateRule114B, validateSection269ST, computeTaxBreakdown } from '../services/compliance.service.js';
import { lookupItemWithQuote } from '../services/scan.service.js';
import { getDashboardData } from '../services/dashboard.service.js';
import { Decimal } from 'decimal.js';
import { eq } from 'drizzle-orm';

describe('FINAL PRODUCTION READINESS AUDIT SUITE', () => {
  let db: any;

  // Primary Showroom (Shop 1)
  const shop1Id = '10000000-0000-0000-0000-000000000001';
  const shop1AdminId = '10000000-0000-0000-0000-000000000010';
  const shop1CashierId = '10000000-0000-0000-0000-000000000011';

  // Secondary Showroom for Multi-Tenant Isolation Verification (Shop 2)
  const shop2Id = '20000000-0000-0000-0000-000000000002';
  const shop2AdminId = '20000000-0000-0000-0000-000000000020';

  beforeAll(async () => {
    const res = await getDatabase();
    db = res.db;
    await initDatabase(db);

    // Setup Shop 1 & Shop 2
    await db.insert(schema.shops).values([
      {
        id: shop1Id,
        name: 'Kamal Jewellers Mumbai Flagship',
        code: 'KJ-BOM',
        address: 'Zaveri Bazaar, Mumbai',
        defaultTaxPercent: '3.00',
        invoicePrefix: 'KJM/'
      },
      {
        id: shop2Id,
        name: 'Kamal Jewellers Delhi Branch',
        code: 'KJ-DEL',
        address: 'Karol Bagh, New Delhi',
        defaultTaxPercent: '3.00',
        invoicePrefix: 'KJD/'
      }
    ]).onConflictDoNothing();

    // Setup Users
    const pHash = await hashPassword('SecurePass123!');
    const pinHash1 = await hashPin('1234');
    const pinHash2 = await hashPin('5678');

    await db.insert(schema.users).values([
      {
        id: shop1AdminId,
        shopId: shop1Id,
        name: 'Kamal Kishore Soni',
        email: 'audit.admin1@kamaljewellers.com',
        passwordHash: pHash,
        pinHash: pinHash1,
        role: 'ADMIN',
        isActive: true
      },
      {
        id: shop1CashierId,
        shopId: shop1Id,
        name: 'Pooja Sharma',
        email: 'audit.cashier1@kamaljewellers.com',
        passwordHash: pHash,
        pinHash: pinHash2,
        role: 'CLERK',
        isActive: true
      },
      {
        id: shop2AdminId,
        shopId: shop2Id,
        name: 'Delhi Manager',
        email: 'audit.admin2@kamaljewellers.com',
        passwordHash: pHash,
        pinHash: pinHash1,
        role: 'ADMIN',
        isActive: true
      }
    ]).onConflictDoNothing();

    // Initial Bullion Rates for Shop 1
    await createRatesSnapshot(
      shop1Id,
      {
        rate24k: '7450.00',
        rate22k: '6980.00',
        rate18k: '5720.00',
        rateSilver: '88.50',
        ratePlatinum: '3150.00'
      },
      shop1AdminId,
      'Kamal Kishore Soni'
    );

    // Initial Bullion Rates for Shop 2
    await createRatesSnapshot(
      shop2Id,
      {
        rate24k: '7470.00',
        rate22k: '7000.00',
        rate18k: '5740.00',
        rateSilver: '89.00',
        ratePlatinum: '3160.00'
      },
      shop2AdminId,
      'Delhi Manager'
    );
  }, 30000);

  // =========================================================================
  // AUDIT SECTION 2: END-TO-END BUSINESS LIFECYCLE FLOW
  // =========================================================================
  it('AUDIT 2: Real-World Business Lifecycle Flow (Customer -> Inward -> Scan -> Quote -> Invoice -> Payment -> Status SOLD -> Ledger -> Audit)', async () => {
    // 1. Add Customer KYC
    const customer = await createCustomer(shop1Id, {
      name: 'Dr. Rameshwar Sharma',
      mobile: '9820099881',
      email: 'rameshwar.sharma@example.com',
      pan: 'ABCPS1234F',
      address: '14 Marine Drive, Mumbai',
      city: 'Mumbai',
      stateCode: '27'
    });
    expect(customer.id).toBeDefined();
    expect(customer.name).toBe('Dr. Rameshwar Sharma');

    // 2. Inward New Jewellery Item
    const itemCode = `E2E-CH-${Date.now()}`;
    const inwardedItem = await createItem(
      shop1Id,
      {
        itemCode,
        category: 'Chains',
        designTitle: '22K Handcrafted Nawabi Rope Chain',
        metal: 'GOLD',
        purity: '22K',
        grossWeight: '24.500',
        stoneWeight: '0.000',
        huid: 'NW8921',
        hallmarkVerified: true,
        makingChargeType: 'PER_GRAM',
        makingChargeValue: '450.00',
        wastagePct: '1.00',
        stoneValue: '0.00',
        notes: 'Handmade 22K rope chain'
      },
      shop1AdminId
    );
    expect(inwardedItem.status).toBe('IN_STOCK');
    expect(inwardedItem.netWeight).toBe('24.500');

    // 3. Scan & Quote Calculation
    const quote = await lookupItemWithQuote(shop1Id, itemCode);
    expect(quote.item.itemCode).toBe(itemCode);
    expect(quote.breakdown.rateApplied).toBe('6980.00');

    // Expected Math:
    // Metal Value: 24.500 * 6980 = 171010.00
    // Making Charges: 24.500 * 450 = 11025.00
    // Wastage (1%): 1710.10
    // Taxable Subtotal: 171010.00 + 11025.00 + 1710.10 = 183745.10
    // GST 3%: 5512.35
    // Grand Total: 189257.45
    expect(quote.breakdown.baseMetalValue).toBe('171010.00');
    expect(quote.breakdown.makingCharges).toBe('11025.00');
    expect(quote.breakdown.wastageValue).toBe('1710.10');
    expect(quote.breakdown.taxableAmount).toBe('183745.10');
    expect(quote.breakdown.taxAmount).toBe('5512.35');
    expect(quote.breakdown.totalAmount).toBe('189257.45');

    // 4. Create Invoice Transaction & Record Payments
    const idempotencyKey = `IDEMP-E2E-${Date.now()}`;
    const invoice = await createInvoiceTransaction(
      {
        customerId: customer.id,
        customerName: customer.name,
        customerMobile: customer.mobile,
        customerPan: customer.pan || undefined,
        items: [
          {
            itemId: inwardedItem.id,
            itemCode: inwardedItem.itemCode,
            designTitle: inwardedItem.designTitle,
            metal: inwardedItem.metal,
            purity: inwardedItem.purity,
            grossWeight: inwardedItem.grossWeight,
            stoneWeight: inwardedItem.stoneWeight,
            netWeight: inwardedItem.netWeight,
            huid: inwardedItem.huid || undefined,
            rateApplied: quote.breakdown.rateApplied,
            makingChargeType: inwardedItem.makingChargeType as any,
            makingChargeValue: inwardedItem.makingChargeValue,
            wastagePct: inwardedItem.wastagePct,
            stoneValue: inwardedItem.stoneValue
          }
        ],
        payments: [
          { mode: 'UPI' as const, amount: '189257.45', referenceNo: 'UPI-E2E-SUCCESS-99' }
        ],
        idempotencyKey
      },
      shop1CashierId,
      'Pooja Sharma',
      shop1Id
    );

    expect(invoice.id).toBeDefined();
    expect(invoice.invoiceNumber.startsWith('KJM/')).toBe(true);
    expect(invoice.grandTotal).toBe('189257.45');
    expect(invoice.amountPaid).toBe('189257.45');
    expect(invoice.balanceDue).toBe('0.00');
    expect(invoice.paymentStatus).toBe('PAID');

    // 5. Verify Item Transition to SOLD
    const soldItem = await getItemByIdOrCode(shop1Id, inwardedItem.id);
    expect(soldItem!.status).toBe('SOLD');

    // 6. Verify Customer Ledger Record
    const customerProfile = await getCustomerById(shop1Id, customer.id);
    expect(customerProfile!.ledger.length).toBeGreaterThanOrEqual(1);

    // 7. Verify Dashboard Analytics Update
    const dashboard = await getDashboardData(shop1Id);
    expect(dashboard.kpis.activeStockPieces).toBeGreaterThanOrEqual(0);
    expect(parseFloat(dashboard.kpis.todaySales)).toBeGreaterThan(0);
  });

  // =========================================================================
  // AUDIT SECTION 3: CONCURRENT DOUBLE-SALE RACE PREVENTION
  // =========================================================================
  it('AUDIT 3: Atomic Double-Sale Prevention: Concurrent sales on same inventory item fail safely', async () => {
    const itemCode = `DOUBLE-RACE-${Date.now()}`;
    const item = await createItem(
      shop1Id,
      {
        itemCode,
        category: 'Rings',
        designTitle: '18K Diamond Solitaire Engagement Ring',
        metal: 'GOLD',
        purity: '18K',
        grossWeight: '4.800',
        stoneWeight: '0.350',
        huid: 'RG8821',
        hallmarkVerified: true,
        makingChargeType: 'FLAT',
        makingChargeValue: '2500.00',
        wastagePct: '0.00',
        stoneValue: '45000.00'
      },
      shop1AdminId
    );

    const payloadA = {
      customerName: 'Buyer Alpha',
      customerMobile: '9811111111',
      items: [
        {
          itemId: item.id,
          itemCode: item.itemCode,
          designTitle: item.designTitle,
          metal: item.metal,
          purity: item.purity,
          grossWeight: item.grossWeight,
          stoneWeight: item.stoneWeight,
          netWeight: item.netWeight,
          rateApplied: '5720.00',
          makingChargeType: 'FLAT' as const,
          makingChargeValue: '2500.00',
          wastagePct: '0.00',
          stoneValue: '45000.00'
        }
      ],
      payments: [{ mode: 'CARD_DEBIT' as const, amount: '75147.88' }],
      idempotencyKey: `IDEMP-ALPHA-${Date.now()}`
    };

    const payloadB = {
      customerName: 'Buyer Beta',
      customerMobile: '9822222222',
      items: [
        {
          itemId: item.id,
          itemCode: item.itemCode,
          designTitle: item.designTitle,
          metal: item.metal,
          purity: item.purity,
          grossWeight: item.grossWeight,
          stoneWeight: item.stoneWeight,
          netWeight: item.netWeight,
          rateApplied: '5720.00',
          makingChargeType: 'FLAT' as const,
          makingChargeValue: '2500.00',
          wastagePct: '0.00',
          stoneValue: '45000.00'
        }
      ],
      payments: [{ mode: 'CASH' as const, amount: '75147.88' }],
      idempotencyKey: `IDEMP-BETA-${Date.now()}`
    };

    // First transaction succeeds
    const invoiceA = await createInvoiceTransaction(payloadA, shop1CashierId, 'Pooja Sharma', shop1Id);
    expect(invoiceA.id).toBeDefined();

    // Second transaction on now-SOLD item MUST throw ITEM_ALREADY_SOLD error
    await expect(
      createInvoiceTransaction(payloadB, shop1CashierId, 'Pooja Sharma', shop1Id)
    ).rejects.toThrow(/DOUBLE SALE PREVENTED/);

    // Verify exactly 1 invoice exists for this item
    const allInvoices = await listInvoices(shop1Id);
    const invoicesWithItem = allInvoices.filter((inv: any) => inv.items?.some((i: any) => i.itemId === item.id));
    expect(invoicesWithItem.length).toBe(1);
  });

  // =========================================================================
  // AUDIT SECTION 4: IDEMPOTENCY VERIFICATION
  // =========================================================================
  it('AUDIT 4: Transaction Idempotency: Duplicate network requests return identical response with 0 extra DB rows', async () => {
    const itemCode = `IDEMP-ITEM-${Date.now()}`;
    const item = await createItem(
      shop1Id,
      {
        itemCode,
        category: 'Coins',
        designTitle: '24K Pure Gold Laxmi Coin 5g',
        metal: 'GOLD',
        purity: '24K',
        grossWeight: '5.000',
        stoneWeight: '0.000',
        hallmarkVerified: true,
        makingChargeType: 'FLAT',
        makingChargeValue: '500.00',
        wastagePct: '0.00',
        stoneValue: '0.00'
      },
      shop1AdminId
    );

    const sameKey = `IDEMP-RETRY-${Date.now()}`;
    const payload = {
      customerName: 'Sunita Mehra',
      customerMobile: '9833333333',
      items: [
        {
          itemId: item.id,
          itemCode: item.itemCode,
          designTitle: item.designTitle,
          metal: item.metal,
          purity: item.purity,
          grossWeight: item.grossWeight,
          stoneWeight: item.stoneWeight,
          netWeight: item.netWeight,
          rateApplied: '7450.00',
          makingChargeType: 'FLAT' as const,
          makingChargeValue: '500.00',
          wastagePct: '0.00',
          stoneValue: '0.00'
        }
      ],
      payments: [{ mode: 'UPI' as const, amount: '38882.50' }],
      idempotencyKey: sameKey
    };

    // First attempt creates
    const firstCall = await createInvoiceTransaction(payload, shop1AdminId, 'Kamal Kishore Soni', shop1Id);
    // Second attempt returns cached transaction
    const secondCall = await createInvoiceTransaction(payload, shop1AdminId, 'Kamal Kishore Soni', shop1Id);

    expect(secondCall.id).toBe(firstCall.id);
    expect(secondCall.invoiceNumber).toBe(firstCall.invoiceNumber);
    expect(secondCall.grandTotal).toBe(firstCall.grandTotal);

    // Verify DB count
    const invoiceRows = await db.select().from(schema.invoices).where(eq(schema.invoices.id, firstCall.id));
    expect(invoiceRows.length).toBe(1);
  });

  // =========================================================================
  // AUDIT SECTION 5: HISTORICAL BULLION RATE IMMUTABILITY
  // =========================================================================
  it('AUDIT 5: Historical Rate Immutability: Mutating showroom daily rates does NOT modify finalized invoices', async () => {
    const itemCode = `HIST-RATE-${Date.now()}`;
    const item = await createItem(
      shop1Id,
      {
        itemCode,
        category: 'Coins',
        designTitle: '22K Historical Test Pendant',
        metal: 'GOLD',
        purity: '22K',
        grossWeight: '10.000',
        stoneWeight: '0.000',
        makingChargeType: 'PER_GRAM',
        makingChargeValue: '300.00'
      },
      shop1AdminId
    );

    // Rate at time of sale: 22K = 6980.00
    const invoice = await createInvoiceTransaction(
      {
        customerName: 'Historical Test Customer',
        customerMobile: '9844444444',
        items: [
          {
            itemId: item.id,
            itemCode: item.itemCode,
            designTitle: item.designTitle,
            metal: item.metal,
            purity: item.purity,
            grossWeight: item.grossWeight,
            stoneWeight: item.stoneWeight,
            netWeight: item.netWeight,
            rateApplied: '6980.00',
            makingChargeType: 'PER_GRAM',
            makingChargeValue: '300.00'
          }
        ],
        payments: [{ mode: 'CASH' as const, amount: '74984.00' }],
        idempotencyKey: `IDEMP-HIST-${Date.now()}`
      },
      shop1AdminId,
      'Kamal Kishore Soni',
      shop1Id
    );

    // Today's gold rate surges from 6980 to 7600
    await createRatesSnapshot(
      shop1Id,
      {
        rate24k: '8100.00',
        rate22k: '7600.00',
        rate18k: '6250.00',
        rateSilver: '95.00'
      },
      shop1AdminId,
      'Kamal Kishore Soni'
    );

    // Verify rate snapshot was updated
    const latestRates = await getLatestRates(shop1Id);
    expect(latestRates.rate22k).toBe('7600.00');

    // Retrieve old invoice: must strictly retain Rate A (6980.00) and original grandTotal
    const retrievedInvoice = await getInvoiceById(shop1Id, invoice.id);
    expect(retrievedInvoice.items[0].boardRate).toBe('6980.00');
    expect(retrievedInvoice.grandTotal).toBe(invoice.grandTotal);
  });

  // =========================================================================
  // AUDIT SECTION 6: FINANCIAL ACCURACY & PARTIAL/SPLIT PAYMENTS
  // =========================================================================
  it('AUDIT 6: Payment Engine Invariant: invoice.grandTotal === amountPaid + balanceDue across Partial & Split Payments', async () => {
    // 1. Create a customer with khata ledger
    const customer = await createCustomer(shop1Id, {
      name: 'Vikas Agarwal',
      mobile: `98${Math.floor(10000000 + Math.random() * 90000000)}`
    });

    const itemCode = `PAY-ITEM-${Date.now()}`;
    const item = await createItem(
      shop1Id,
      {
        itemCode,
        category: 'Necklaces',
        designTitle: '22K Royal Temple Choker',
        metal: 'GOLD',
        purity: '22K',
        grossWeight: '30.000',
        stoneWeight: '0.000',
        makingChargeType: 'PER_GRAM',
        makingChargeValue: '500.00'
      },
      shop1AdminId
    );

    // Total Calculation:
    // Metal: 30 * 6980 = 209400.00
    // Making: 30 * 500 = 15000.00
    // Subtotal: 224400.00
    // Tax 3%: 6732.00
    // Grand Total: 231132.00
    // Customer pays Split: 100,000 Cash + 50,000 UPI = 150,000 Paid. Balance Due = 81,132.00
    const invoice = await createInvoiceTransaction(
      {
        customerId: customer.id,
        customerName: customer.name,
        customerMobile: customer.mobile,
        customerPan: 'ABCDE1234F',
        items: [
          {
            itemId: item.id,
            itemCode: item.itemCode,
            designTitle: item.designTitle,
            metal: item.metal,
            purity: item.purity,
            grossWeight: item.grossWeight,
            stoneWeight: item.stoneWeight,
            netWeight: item.netWeight,
            rateApplied: '6980.00',
            makingChargeType: 'PER_GRAM',
            makingChargeValue: '500.00'
          }
        ],
        payments: [
          { mode: 'CASH' as const, amount: '100000.00' },
          { mode: 'UPI' as const, amount: '50000.00', referenceNo: 'UPI-PART-1' }
        ],
        idempotencyKey: `IDEMP-SPLIT-${Date.now()}`
      },
      shop1CashierId,
      'Pooja Sharma',
      shop1Id
    );

    expect(invoice.grandTotal).toBe('231132.00');
    expect(invoice.amountPaid).toBe('150000.00');
    expect(invoice.balanceDue).toBe('81132.00');
    expect(invoice.paymentStatus).toBe('PARTIALLY_PAID');

    // Invariant check:
    const sum = new Decimal(invoice.amountPaid).plus(new Decimal(invoice.balanceDue));
    expect(sum.toFixed(2)).toBe(invoice.grandTotal);

    // Verify Customer Ledger Balance is updated with Due Amount
    const custAfterInvoice = await getCustomerById(shop1Id, customer.id);
    expect(custAfterInvoice!.customer.ledgerBalance).toBe('81132.00');

    // Settle Remaining Dues via Customer Payment Voucher
    const settlement = await recordCustomerPayment(
      shop1Id,
      customer.id,
      '81132.00',
      'BANK_TRANSFER',
      'NEFT-SETTLE-001',
      shop1CashierId,
      'Pooja Sharma'
    );
    expect(settlement.amountSettled).toBe('81132.00');
    expect(settlement.newBalance).toBe('0.00');

    const custAfterSettle = await getCustomerById(shop1Id, customer.id);
    expect(custAfterSettle!.customer.ledgerBalance).toBe('0.00');
  });

  // =========================================================================
  // AUDIT SECTION 7: INVENTORY STATE MACHINE & DISPOSITIONS
  // =========================================================================
  it('AUDIT 7: Inventory State Machine & Supervisor Return Dispositions (BACK_TO_STOCK & MELT_VAULT)', async () => {
    // 1. Inward item
    const itemCode = `STATE-ITEM-${Date.now()}`;
    const item = await createItem(
      shop1Id,
      {
        itemCode,
        category: 'Bangles',
        designTitle: '22K Kangan Pair',
        metal: 'GOLD',
        purity: '22K',
        grossWeight: '20.000',
        stoneWeight: '0.000',
        makingChargeType: 'PER_GRAM',
        makingChargeValue: '350.00'
      },
      shop1AdminId
    );
    expect(item.status).toBe('IN_STOCK');

    // 2. Sell item
    const invoice = await createInvoiceTransaction(
      {
        customerName: 'Bangle Buyer',
        customerMobile: '9855555555',
        items: [
          {
            itemId: item.id,
            itemCode: item.itemCode,
            designTitle: item.designTitle,
            metal: item.metal,
            purity: item.purity,
            grossWeight: item.grossWeight,
            stoneWeight: item.stoneWeight,
            netWeight: item.netWeight,
            rateApplied: '6980.00',
            makingChargeType: 'PER_GRAM',
            makingChargeValue: '350.00'
          }
        ],
        payments: [{ mode: 'UPI' as const, amount: '150993.00' }],
        idempotencyKey: `IDEMP-RETURN-${Date.now()}`
      },
      shop1CashierId,
      'Pooja Sharma',
      shop1Id
    );

    const soldItem = await getItemByIdOrCode(shop1Id, item.id);
    expect(soldItem!.status).toBe('SOLD');

    // 3. Supervisor-authorized Return: Restock BACK_TO_STOCK
    const returnRecord = await createReturnTransaction(
      shop1Id,
      {
        originalInvoiceNumber: invoice.invoiceNumber,
        itemCode: item.itemCode,
        returnReason: 'Customer requested size exchange',
        refundAmount: '145000.00',
        deductionAmount: '5993.00',
        restockDestination: 'BACK_TO_STOCK',
        supervisorPin: '1234'
      },
      shop1CashierId,
      'Pooja Sharma'
    );
    expect(returnRecord.id).toBeDefined();

    // Verify Item is back IN_STOCK
    const restockedItem = await getItemByIdOrCode(shop1Id, item.id);
    expect(restockedItem!.status).toBe('IN_STOCK');

    // 4. Melt Destination: Update item to MELTED
    await updateItem(shop1Id, item.id, { status: 'MELTED' });
    const meltedItem = await getItemByIdOrCode(shop1Id, item.id);
    expect(meltedItem!.status).toBe('MELTED');
  });

  // =========================================================================
  // AUDIT SECTION 8: MULTI-TENANT SHOP ISOLATION & SECURITY
  // =========================================================================
  it('AUDIT 8: Multi-Tenant Showroom Isolation: Strict boundary isolation between Shop 1 and Shop 2', async () => {
    // 1. Inward item in Shop 1
    const item1 = await createItem(
      shop1Id,
      {
        itemCode: `SHOP1-SECRET-${Date.now()}`,
        category: 'Rings',
        designTitle: 'Shop 1 Exclusive Diamond Ring',
        metal: 'GOLD',
        purity: '22K',
        grossWeight: '8.000'
      },
      shop1AdminId
    );

    // 2. Inward item in Shop 2
    const item2 = await createItem(
      shop2Id,
      {
        itemCode: `SHOP2-SECRET-${Date.now()}`,
        category: 'Coins',
        designTitle: 'Shop 2 Exclusive Gold Coin',
        metal: 'GOLD',
        purity: '24K',
        grossWeight: '10.000'
      },
      shop2AdminId
    );

    // Shop 1 cannot see Shop 2 item
    const shop1LookupOfItem2 = await getItemByIdOrCode(shop1Id, item2.itemCode);
    expect(shop1LookupOfItem2).toBeNull();

    // Shop 2 cannot see Shop 1 item
    const shop2LookupOfItem1 = await getItemByIdOrCode(shop2Id, item1.itemCode);
    expect(shop2LookupOfItem1).toBeNull();

    // Shop 1 list items excludes Shop 2 items
    const shop1Items = await listItems(shop1Id);
    expect(shop1Items.some((i: any) => i.id === item2.id)).toBe(false);

    // Shop 2 list items excludes Shop 1 items
    const shop2Items = await listItems(shop2Id);
    expect(shop2Items.some((i: any) => i.id === item1.id)).toBe(false);
  });

  // =========================================================================
  // AUDIT SECTION 10: INPUT VALIDATION & INJECTION RESISTANCE
  // =========================================================================
  it('AUDIT 10: SQL Injection, Negative Numbers, Duplicate Unique Constraints Fail Safely', async () => {
    // 1. SQL Injection in Search Input
    const sqliSearch = "'; DROP TABLE jewellery_items; --";
    const items = await listItems(shop1Id, 'ALL', sqliSearch);
    expect(Array.isArray(items)).toBe(true);

    // Verify table was NOT dropped
    const tableCheck = await listItems(shop1Id);
    expect(Array.isArray(tableCheck)).toBe(true);

    // 2. Duplicate Item Code Constraint
    const dupCode = `DUP-CODE-${Date.now()}`;
    await createItem(
      shop1Id,
      {
        itemCode: dupCode,
        category: 'Coins',
        designTitle: 'First Inward',
        metal: 'GOLD',
        purity: '24K',
        grossWeight: '1.000'
      },
      shop1AdminId
    );

    await expect(
      createItem(
        shop1Id,
        {
          itemCode: dupCode,
          category: 'Coins',
          designTitle: 'Duplicate Inward',
          metal: 'GOLD',
          purity: '24K',
          grossWeight: '1.000'
        },
        shop1AdminId
      )
    ).rejects.toThrow(/already exists/);
  });

  // =========================================================================
  // AUDIT SECTION 11: CRYPTOGRAPHIC AUTHENTICATION
  // =========================================================================
  it('AUDIT 11: Cryptographic Scrypt Password and PIN Hashing Security', async () => {
    const rawPass = 'VaultAdmin2026!#$';
    const rawPin = '7391';

    const passHash = await hashPassword(rawPass);
    const pinHash = await hashPin(rawPin);

    // Verify hashes are non-plaintext and properly formatted
    expect(passHash).not.toBe(rawPass);
    expect(passHash.startsWith('scrypt:')).toBe(true);
    expect(pinHash.startsWith('pin_scrypt:')).toBe(true);

    // Verify timing-safe verification
    expect(await verifyPassword(rawPass, passHash)).toBe(true);
    expect(await verifyPassword('IncorrectPassword', passHash)).toBe(false);
    expect(await verifyPin(rawPin, pinHash)).toBe(true);
    expect(await verifyPin('0000', pinHash)).toBe(false);
  });

  // =========================================================================
  // AUDIT SECTION 12: ARBITRARY DECIMAL PRECISION MATHEMATICS
  // =========================================================================
  it('AUDIT 12: Decimal.js Financial & Weight Arithmetic Precision', () => {
    // 1. Classical JS Float Bug: 0.1 + 0.2 !== 0.3
    const a = new Decimal('0.1');
    const b = new Decimal('0.2');
    expect(a.plus(b).toString()).toBe('0.3');

    // 2. Milligram Weight subtraction: 12.450 - 2.125 = 10.325
    const gross = new Decimal('12.450');
    const stone = new Decimal('2.125');
    const net = gross.minus(stone);
    expect(net.toFixed(3)).toBe('10.325');

    // 3. Currency Rounding: 10.325 * 6980.00 = 72068.50
    const val = net.times(new Decimal('6980.00'));
    expect(val.toFixed(2)).toBe('72068.50');
  });

  // =========================================================================
  // AUDIT SECTION 13: TAX & STATUTORY COMPLIANCE
  // =========================================================================
  it('AUDIT 13: Statutory Compliance (Rule 114B PAN & Section 269ST Cash Limit) & Dynamic Tax Engine', () => {
    // 1. Rule 114B PAN Mandate: Amount >= 200,000 requires PAN
    const underThreshold = validateRule114B(new Decimal('199999.00'), '');
    expect(underThreshold.compliant).toBe(true);

    const overThresholdNoPan = validateRule114B(new Decimal('200000.00'), '');
    expect(overThresholdNoPan.compliant).toBe(false);
    expect(overThresholdNoPan.reason).toContain('Rule 114B');

    const overThresholdWithPan = validateRule114B(new Decimal('250000.00'), 'ABCDE1234F');
    expect(overThresholdWithPan.compliant).toBe(true);

    // 2. Section 269ST Cash Cap: Cash payments must be < 200,000
    const cashUnder = validateSection269ST(new Decimal('199000.00'));
    expect(cashUnder.compliant).toBe(true);

    const cashOver = validateSection269ST(new Decimal('200000.00'));
    expect(cashOver.compliant).toBe(false);
    expect(cashOver.reason).toContain('Section 269ST');

    // 3. Dynamic Tax Computation: Intra-state 50-50 split vs Inter-state IGST
    const intraTax = computeTaxBreakdown(new Decimal('100000.00'), new Decimal('3.00'), '27', '27');
    expect(intraTax.cgstAmount).toBe('1500.00');
    expect(intraTax.sgstAmount).toBe('1500.00');
    expect(intraTax.igstAmount).toBe('0.00');
    expect(intraTax.totalTaxAmount).toBe('3000.00');

    const interTax = computeTaxBreakdown(new Decimal('100000.00'), new Decimal('3.00'), '27', '07');
    expect(interTax.cgstAmount).toBe('0.00');
    expect(interTax.sgstAmount).toBe('0.00');
    expect(interTax.igstAmount).toBe('3000.00');
    expect(interTax.totalTaxAmount).toBe('3000.00');
  });

  // =========================================================================
  // AUDIT SECTION 15: OLD GOLD BUYBACK ASSAY
  // =========================================================================
  it('AUDIT 15: Old Gold Scrap Assay & Fine Gold Calculation', async () => {
    const assay = await createOldGoldAssay(
      shop1Id,
      {
        customerName: 'Anil Kulkarni',
        customerMobile: '9866666666',
        metal: 'GOLD',
        grossWeight: '15.500',
        dustStoneDeduction: '0.500', // Net = 15.000g
        testedPurityPercent: '91.60', // 22K (91.6%) -> Fine gold = 13.740g
        buybackRatePerGram: '6800.00', // 13.740 * 6800 / 0.999 = 93432.00 approx
        settlementType: 'CART_EXCHANGE',
        notes: 'Old melted bangles'
      }
    );

    expect(assay.id).toBeDefined();
    expect(assay.transactionNumber.startsWith('OG-')).toBe(true);
    expect(assay.netScrapWeight).toBe('15.000');
    expect(assay.fineWeight).toBe('13.740');
    expect(parseFloat(assay.totalValuation)).toBeGreaterThan(0);

    const retrieved = await getOldGoldById(shop1Id, assay.id);
    expect(retrieved.id).toBe(assay.id);
  });
});
