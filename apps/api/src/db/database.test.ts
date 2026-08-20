import { describe, it, expect, beforeAll } from 'vitest';
import { getDatabase, initDatabase } from './connection.js';
import * as schema from './schema/index.js';
import { hashPassword, verifyPassword, hashPin, verifyPin } from '../services/crypto.js';
import { createItem, getItemByIdOrCode } from '../services/items.service.js';
import { createCustomer, getCustomerById, recordCustomerPayment } from '../services/customers.service.js';
import { createInvoiceTransaction, getInvoiceById } from '../services/billing.service.js';
import { createRatesSnapshot } from '../services/rates.service.js';
import { createReturnTransaction } from '../services/returns.service.js';
import { createOldGoldAssay } from '../services/oldGold.service.js';
import { validateRule114B, validateSection269ST, computeTaxBreakdown } from '../services/compliance.service.js';
import { Decimal } from 'decimal.js';
import { eq } from 'drizzle-orm';

describe('PostgreSQL Database Persistence & Transaction Integrity Test Suite', () => {
  let db: any;
  const shopId = '00000000-0000-0000-0000-000000000001';
  const adminId = '00000000-0000-0000-0000-000000000010';
  const cashierId = '00000000-0000-0000-0000-000000000011';

  beforeAll(async () => {
    const res = await getDatabase();
    db = res.db;
    await initDatabase(db);

    // Ensure shop exists
    const existing = await db.select().from(schema.shops).where(eq(schema.shops.id, shopId));
    if (existing.length === 0) {
      await db.insert(schema.shops).values({
        id: shopId,
        name: 'Kamal Jewellers Test Flagship',
        code: 'KJ-TEST',
        address: 'Zaveri Bazaar, Mumbai',
        defaultTaxPercent: '3.00',
        invoicePrefix: 'KJ-TEST/'
      });
    }

    // Ensure admin and cashier users exist with hashed credentials
    const adminPass = await hashPassword('password123');
    const adminPin = await hashPin('1234');
    const cashierPass = await hashPassword('password123');
    const cashierPin = await hashPin('5678');

    await db.insert(schema.users).values([
      {
        id: adminId,
        shopId,
        name: 'Kamal Kishore Soni',
        email: 'admin.test@kamaljewellers.com',
        passwordHash: adminPass,
        pinHash: adminPin,
        role: 'ADMIN',
        isActive: true
      },
      {
        id: cashierId,
        shopId,
        name: 'Pooja Sharma',
        email: 'cashier.test@kamaljewellers.com',
        passwordHash: cashierPass,
        pinHash: cashierPin,
        role: 'CLERK',
        isActive: true
      }
    ]).onConflictDoNothing();

    // Ensure initial rate exists
    await createRatesSnapshot(
      shopId,
      {
        rate24k: '7450.00',
        rate22k: '6980.00',
        rate18k: '5720.00',
        rateSilver: '88.50'
      },
      adminId,
      'Kamal Kishore Soni'
    );
  }, 30000);

  it('1. Cryptographic Security: Password and PIN hashing verify correctly without plaintext', async () => {
    const rawPass = 'SecretAdmin123!';
    const rawPin = '9876';

    const passHash = await hashPassword(rawPass);
    const pinHash = await hashPin(rawPin);

    expect(passHash).not.toBe(rawPass);
    expect(passHash.startsWith('scrypt:')).toBe(true);
    expect(pinHash.startsWith('pin_scrypt:')).toBe(true);

    const isPassValid = await verifyPassword(rawPass, passHash);
    const isPassInvalid = await verifyPassword('WrongPassword', passHash);
    expect(isPassValid).toBe(true);
    expect(isPassInvalid).toBe(false);

    const isPinValid = await verifyPin(rawPin, pinHash);
    const isPinInvalid = await verifyPin('1111', pinHash);
    expect(isPinValid).toBe(true);
    expect(isPinInvalid).toBe(false);
  });

  it('2. Item Persistence & Milligram Weight Math: Inward item and verify gross - stone = net', async () => {
    const itemCode = `TEST-GLD-${Date.now()}`;
    const created = await createItem(
      shopId,
      {
        itemCode,
        category: 'Necklace',
        designTitle: 'Test Filigree Choker',
        metal: 'GOLD',
        purity: '22K',
        grossWeight: '25.650',
        stoneWeight: '1.200',
        huid: 'HT9912',
        makingChargeType: 'PER_GRAM',
        makingChargeValue: '450.00',
        wastagePct: '1.50'
      },
      adminId
    );

    expect(created.id).toBeDefined();
    expect(created.netWeight).toBe('24.450'); // 25.650 - 1.200 = 24.450g
    expect(created.status).toBe('IN_STOCK');

    const fetched = await getItemByIdOrCode(shopId, itemCode);
    expect(fetched).not.null;
    expect(fetched!.huid).toBe('HT9912');
  });

  it('3. Customer KYC & Khata Ledger: Create customer, record dues payment, verify ledger history', async () => {
    const mobile = `98${Math.floor(10000000 + Math.random() * 90000000)}`;
    const cust = await createCustomer(shopId, {
      name: 'Shri Vikramaditya Test',
      mobile,
      pan: 'ABCDE1234F',
      address: 'Marine Drive, Mumbai'
    });

    expect(cust.id).toBeDefined();
    expect(cust.ledgerBalance).toBe('0.00');

    // Simulate dues payment
    const paymentResult = await recordCustomerPayment(
      shopId,
      cust.id,
      '5000.00',
      'UPI',
      'UPI-TEST-9988',
      adminId,
      'Kamal Kishore Soni'
    );

    expect(paymentResult.receiptNumber.startsWith('RCP-')).toBe(true);
    expect(paymentResult.amountSettled).toBe('5000.00');

    const customerDetail = await getCustomerById(shopId, cust.id);
    expect(customerDetail!.ledger.length).toBeGreaterThan(0);
    expect(customerDetail!.ledger[0].credit).toBe('5000.00');
  });

  it('4. Atomic Sale Transaction: Confirms sale, locks inventory, updates status to SOLD, creates invoice', async () => {
    const itemCode = `TEST-RING-${Date.now()}`;
    const ring = await createItem(
      shopId,
      {
        itemCode,
        category: 'Rings',
        designTitle: 'Solitaire Ring',
        metal: 'GOLD',
        purity: '22K',
        grossWeight: '5.000',
        stoneWeight: '0.000',
        makingChargeType: 'PER_GRAM',
        makingChargeValue: '400.00'
      },
      adminId
    );

    const idempotencyKey = `sale-key-${Date.now()}`;
    const invoice = await createInvoiceTransaction(
      {
        customerName: 'Smt. Ananya Roy',
        customerMobile: '9820099881',
        customerPan: 'XYZPA1234B',
        items: [
          {
            itemId: ring.id,
            itemCode: ring.itemCode,
            designTitle: ring.designTitle,
            metal: ring.metal as any,
            purity: ring.purity,
            grossWeight: ring.grossWeight,
            stoneWeight: ring.stoneWeight,
            netWeight: ring.netWeight,
            rateApplied: '6980.00',
            makingCharges: '2000.00'
          }
        ],
        payments: [
          {
            mode: 'UPI',
            amount: '37996.70',
            referenceNo: 'UPI-REF-001'
          }
        ],
        idempotencyKey
      },
      adminId,
      'Kamal Kishore Soni',
      shopId
    );

    expect(invoice.id).toBeDefined();
    expect(invoice.invoiceNumber).toBeDefined();
    expect(invoice.items.length).toBe(1);

    // Verify ring is now SOLD in database
    const updatedRing = await getItemByIdOrCode(shopId, ring.id);
    expect(updatedRing!.status).toBe('SOLD');
  });

  it('5. Double Sale Prevention: Attempting to sell an already SOLD item is strictly rejected', async () => {
    const itemCode = `TEST-CHAIN-${Date.now()}`;
    const chain = await createItem(
      shopId,
      {
        itemCode,
        category: 'Chains',
        designTitle: 'Mens Chain',
        metal: 'GOLD',
        purity: '22K',
        grossWeight: '10.000',
        stoneWeight: '0.000',
        makingChargeType: 'PER_GRAM',
        makingChargeValue: '400.00'
      },
      adminId
    );

    // First Sale (Succeeds)
    await createInvoiceTransaction(
      {
        customerName: 'Buyer 1',
        customerMobile: '9820011111',
        items: [
          {
            itemId: chain.id,
            itemCode: chain.itemCode,
            designTitle: chain.designTitle,
            metal: chain.metal as any,
            purity: chain.purity,
            grossWeight: chain.grossWeight,
            netWeight: chain.netWeight,
            rateApplied: '6980.00'
          }
        ],
        payments: [{ mode: 'CASH', amount: '71894.00' }]
      },
      adminId,
      'Kamal Kishore Soni',
      shopId
    );

    // Second Sale Attempt for Same Item (Must Fail)
    await expect(
      createInvoiceTransaction(
        {
          customerName: 'Buyer 2',
          customerMobile: '9820022222',
          items: [
            {
              itemId: chain.id,
              itemCode: chain.itemCode,
              designTitle: chain.designTitle,
              metal: chain.metal as any,
              purity: chain.purity,
              grossWeight: chain.grossWeight,
              netWeight: chain.netWeight,
              rateApplied: '6980.00'
            }
          ],
          payments: [{ mode: 'CASH', amount: '71894.00' }]
        },
        adminId,
        'Kamal Kishore Soni',
        shopId
      )
    ).rejects.toThrow(/DOUBLE SALE PREVENTED/);
  });

  it('6. Idempotency Key Deduplication: Retried sale returns existing invoice without duplicate records', async () => {
    const itemCode = `TEST-IDEM-${Date.now()}`;
    const item = await createItem(
      shopId,
      {
        itemCode,
        category: 'Earrings',
        designTitle: 'Stud Earrings',
        metal: 'GOLD',
        purity: '22K',
        grossWeight: '3.000',
        stoneWeight: '0.000',
        makingChargeType: 'PER_GRAM',
        makingChargeValue: '400.00'
      },
      adminId
    );

    const idempotencyKey = `idem-key-${Date.now()}`;
    const payload = {
      customerName: 'Smt. Priya Test',
      customerMobile: '9820033333',
      items: [
        {
          itemId: item.id,
          itemCode: item.itemCode,
          designTitle: item.designTitle,
          metal: item.metal as any,
          purity: item.purity,
          grossWeight: item.grossWeight,
          netWeight: item.netWeight,
          rateApplied: '6980.00'
        }
      ],
      payments: [{ mode: 'UPI' as const, amount: '21568.20' }],
      idempotencyKey
    };

    const firstInvoice = await createInvoiceTransaction(payload, adminId, 'Kamal Kishore Soni', shopId);
    const retriedInvoice = await createInvoiceTransaction(payload, adminId, 'Kamal Kishore Soni', shopId);

    expect(retriedInvoice.id).toBe(firstInvoice.id);
    expect(retriedInvoice.invoiceNumber).toBe(firstInvoice.invoiceNumber);
  });

  it('7. Historical Snapshot Immutability: Updating gold rates today does not alter past invoices', async () => {
    const itemCode = `TEST-HIST-${Date.now()}`;
    const item = await createItem(
      shopId,
      {
        itemCode,
        category: 'Coins',
        designTitle: '10g 24K Gold Coin',
        metal: 'GOLD',
        purity: '24K',
        grossWeight: '10.000',
        stoneWeight: '0.000',
        makingChargeType: 'FLAT',
        makingChargeValue: '500.00'
      },
      adminId
    );

    const originalInvoice = await createInvoiceTransaction(
      {
        customerName: 'Shri Mohit',
        customerMobile: '9820044444',
        items: [
          {
            itemId: item.id,
            itemCode: item.itemCode,
            designTitle: item.designTitle,
            metal: 'GOLD',
            purity: '24K',
            grossWeight: '10.000',
            netWeight: '10.000',
            rateApplied: '7450.00',
            makingCharges: '500.00'
          }
        ],
        payments: [{ mode: 'CARD_DEBIT', amount: '77250.00' }]
      },
      adminId,
      'Kamal Kishore Soni',
      shopId
    );

    const originalGrandTotal = originalInvoice.grandTotal;

    // Update Today's Bullion Rate to a higher value (₹8,500.00)
    await createRatesSnapshot(
      shopId,
      {
        rate24k: '8500.00',
        rate22k: '7950.00',
        rate18k: '6500.00',
        rateSilver: '95.00'
      },
      adminId,
      'Kamal Kishore Soni'
    );

    // Query original invoice from database
    const refreshedInvoice = await getInvoiceById(shopId, originalInvoice.id);
    expect(refreshedInvoice!.grandTotal).toBe(originalGrandTotal);
    expect(refreshedInvoice!.items[0].boardRate).toBe('7450.00'); // Preserved frozen rate!
  });

  it('8. Old Scrap Gold Assay: Converts scrap to 24K fine gold and computes valuation', async () => {
    const assay = await createOldGoldAssay(
      shopId,
      {
        customerName: 'Smt. Lata',
        customerMobile: '9820055555',
        metal: 'GOLD',
        grossWeight: '15.500',
        dustStoneDeduction: '0.500', // net = 15.000g
        testedPurityPercent: '75.00', // 18K purity -> fine = 11.250g
        buybackRatePerGram: '7250.00',
        settlementType: 'CART_EXCHANGE'
      },
      adminId,
      'Kamal Kishore Soni'
    );

    expect(assay.transactionNumber.startsWith('OG-')).toBe(true);
    expect(assay.netScrapWeight).toBe('15.000');
    expect(assay.fineWeight).toBe('11.250'); // 15.000 * 0.75 = 11.250g
    expect(assay.totalValuation).toBe('81562.50'); // 11.250 * 7250 = 81562.50
  });

  it('9. Supervisor Authorized Sales Return: Verifies PIN, updates item status to IN_STOCK, logs return', async () => {
    const itemCode = `TEST-RET-${Date.now()}`;
    const item = await createItem(
      shopId,
      {
        itemCode,
        category: 'Pendant',
        designTitle: 'Gold Pendant',
        metal: 'GOLD',
        purity: '22K',
        grossWeight: '4.000',
        stoneWeight: '0.000'
      },
      adminId
    );

    const invoice = await createInvoiceTransaction(
      {
        customerName: 'Smt. Returnee',
        customerMobile: '9820066666',
        items: [
          {
            itemId: item.id,
            itemCode: item.itemCode,
            designTitle: item.designTitle,
            metal: 'GOLD',
            purity: '22K',
            grossWeight: '4.000',
            netWeight: '4.000',
            rateApplied: '6980.00'
          }
        ],
        payments: [{ mode: 'CASH', amount: '28757.60' }]
      },
      adminId,
      'Kamal Kishore Soni',
      shopId
    );

    // Verify item is SOLD
    let itemDb = await getItemByIdOrCode(shopId, item.id);
    expect(itemDb!.status).toBe('SOLD');

    // Process Return with correct supervisor PIN (1234)
    const returnRecord = await createReturnTransaction(
      shopId,
      {
        originalInvoiceNumber: invoice.invoiceNumber,
        itemCode: item.itemCode,
        returnReason: 'Customer requested design exchange',
        refundAmount: '28000.00',
        deductionAmount: '500.00',
        restockDestination: 'BACK_TO_STOCK',
        supervisorPin: '1234'
      },
      cashierId,
      'Pooja Sharma'
    );

    expect(returnRecord.returnNumber.startsWith('RET-')).toBe(true);
    expect(returnRecord.netRefundAmount).toBe('27500.00');

    // Verify item is restored to IN_STOCK in vault
    itemDb = await getItemByIdOrCode(shopId, item.id);
    expect(itemDb!.status).toBe('IN_STOCK');
  });

  it('10. Statutory Compliance Isolation: Rule 114B PAN validation and Section 269ST cash enforcement', () => {
    // Rule 114B: Total >= 2,00,000 mandates valid PAN
    const checkNoPan = validateRule114B(new Decimal('250000.00'), null);
    expect(checkNoPan.compliant).toBe(false);
    expect(checkNoPan.reason).toContain('Mandatory PAN required under Rule 114B');

    const checkInvalidPan = validateRule114B(new Decimal('250000.00'), '123INVALID');
    expect(checkInvalidPan.compliant).toBe(false);

    const checkValidPan = validateRule114B(new Decimal('250000.00'), 'ABCDE1234F');
    expect(checkValidPan.compliant).toBe(true);

    const checkUnderLimit = validateRule114B(new Decimal('150000.00'), null);
    expect(checkUnderLimit.compliant).toBe(true);

    // Section 269ST: Cash >= 2,00,000 is prohibited
    const cashBreach = validateSection269ST(new Decimal('200000.00'));
    expect(cashBreach.compliant).toBe(false);
    expect(cashBreach.reason).toContain('Section 269ST violation');

    const cashOk = validateSection269ST(new Decimal('199000.00'));
    expect(cashOk.compliant).toBe(true);

    // Tax Split: Intra-state 50% CGST + 50% SGST
    const tax = computeTaxBreakdown(new Decimal('100000.00'), '3.00', '27', '27');
    expect(tax.cgstAmount).toBe('1500.00');
    expect(tax.sgstAmount).toBe('1500.00');
    expect(tax.igstAmount).toBe('0.00');
    expect(tax.totalTaxAmount).toBe('3000.00');
  });
});
