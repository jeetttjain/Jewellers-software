import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../server.js';
import { FastifyInstance } from 'fastify';
import { getDatabase } from '../db/connection.js';
import * as schema from '../db/schema/index.js';
import { randomUUID } from 'crypto';
import { hashPassword, hashPin } from '../services/crypto.js';
import { createInvoiceTransaction, getInvoiceById, listInvoices, normalizeInvoice } from '../services/billing.service.js';

describe('Invoice Calculation Integrity & Zero-NaN Regression Test', () => {
  let app: FastifyInstance;
  let shopId: string;
  let userId: string;
  let sessionCookie: string;

  beforeAll(async () => {
    app = await buildServer();
    await app.ready();
    const { db } = await getDatabase();

    shopId = randomUUID();
    userId = randomUUID();

    const passwordHash = await hashPassword('AdminPass123!');
    const pinHash = await hashPin('1234');

    await db.insert(schema.shops).values({
      id: shopId,
      name: 'Kamal Jewellers Test',
      code: `KJ_CALC_${Date.now()}`.slice(0, 20),
      address: '104 Zaveri Bazaar',
      defaultTaxPercent: '3.00'
    });

    await db.insert(schema.users).values({
      id: userId,
      shopId,
      name: 'Head Cashier',
      email: `cashier_${Date.now()}@kj.com`,
      passwordHash,
      pinHash,
      role: 'ADMIN',
      isActive: true
    });

    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: `cashier_${Date.now()}@kj.com`,
        password: 'AdminPass123!'
      }
    });

    const cookies = loginRes.headers['set-cookie'];
    sessionCookie = Array.isArray(cookies) ? cookies[0].split(';')[0] : (cookies as string)?.split(';')[0];
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('1. should create an invoice and return valid finite numbers without NaN or undefined for all financial fields', async () => {
    // Replicate production scenario:
    // Taxable: ₹92,732.45, GST 3%: ₹2,781.97, Net Payable: ₹95,514.42
    const invoice = await createInvoiceTransaction(
      {
        customerName: 'Smt. Ananya Sharma',
        customerMobile: '9820011223',
        customerPan: 'ABCDE1234F',
        items: [
          {
            itemCode: 'KJ-TEST-RING-01',
            designTitle: '22K Gold Antique Ring',
            metal: 'GOLD',
            purity: '22K',
            grossWeight: '15.000',
            stoneWeight: '0.500',
            netWeight: '14.500',
            rateApplied: '6000.00',
            makingChargeType: 'PER_GRAM',
            makingChargeValue: '395.34',
            wastagePct: '0.00',
            stoneValue: '0.00',
            discount: '0.00'
          }
        ],
        payments: [
          {
            mode: 'UPI',
            amount: '95514.42',
            referenceNo: 'UPI-TEST-001'
          }
        ]
      },
      userId,
      'Head Cashier',
      shopId
    );

    // Verify Backend Financial Arithmetic
    expect(invoice).toBeDefined();
    expect(Number(invoice.taxableAmount)).toBeGreaterThan(0);
    expect(Number.isFinite(Number(invoice.taxableAmount))).toBe(true);
    expect(Number.isFinite(Number(invoice.totalTaxAmount))).toBe(true);
    expect(Number.isFinite(Number(invoice.grandTotal))).toBe(true);

    // Verify no NaN strings anywhere in response
    expect(invoice.taxableAmount).not.toBe('NaN');
    expect(invoice.totalTaxAmount).not.toBe('NaN');
    expect(invoice.grandTotal).not.toBe('NaN');
    expect(invoice.finalPayable).not.toBe('NaN');
    expect(invoice.cgstAmount).not.toBe('NaN');
    expect(invoice.sgstAmount).not.toBe('NaN');

    // Verify mathematical accuracy:
    // metalValue = 14.5 * 6000 = 87000.00
    // makingCharges = 14.5 * 395.34 = 5732.43
    // taxable = 87000 + 5732.43 = 92732.43
    // tax = 92732.43 * 3% = 2781.97
    // grandTotal = 92732.43 + 2781.97 = 95514.40
    expect(Number(invoice.totalTaxAmount)).toBeCloseTo(Number(invoice.taxableAmount) * 0.03, 1);
    expect(Number(invoice.grandTotal)).toBeCloseTo(Number(invoice.taxableAmount) + Number(invoice.totalTaxAmount), 1);
  });

  it('2. should verify getInvoiceById returns all aliases and valid numbers without NaN', async () => {
    const invoice = await createInvoiceTransaction(
      {
        customerName: 'Shri Rajesh Patel',
        customerMobile: '9820033445',
        items: [
          {
            itemCode: 'KJ-TEST-CHAIN-01',
            designTitle: '22K Gold Italian Chain',
            metal: 'GOLD',
            purity: '22K',
            grossWeight: '10.000',
            stoneWeight: '0.000',
            netWeight: '10.000',
            rateApplied: '6500.00',
            makingChargeType: 'FLAT',
            makingChargeValue: '2500.00',
            wastagePct: '0.00',
            stoneValue: '0.00',
            discount: '500.00'
          }
        ],
        payments: [
          {
            mode: 'CASH',
            amount: '69010.00'
          }
        ]
      },
      userId,
      'Head Cashier',
      shopId
    );

    const fetched = await getInvoiceById(shopId, invoice.id);
    expect(fetched).toBeDefined();

    // Verify aliases
    expect(fetched.finalPayable).toBe(fetched.grandTotal);
    expect(fetched.taxAmount).toBe(fetched.totalTaxAmount);
    expect(fetched.oldGoldDeduction).toBe(fetched.oldGoldDeductionTotal);
    expect(fetched.items[0].baseMetalValue).toBe(fetched.items[0].metalValue);
    expect(fetched.items[0].totalAmount).toBe(fetched.items[0].finalAmount);

    // Verify all values are valid numbers
    expect(Number.isFinite(parseFloat(fetched.grandTotal))).toBe(true);
    expect(Number.isFinite(parseFloat(fetched.finalPayable))).toBe(true);
    expect(Number.isFinite(parseFloat(fetched.taxAmount))).toBe(true);
    expect(Number.isFinite(parseFloat(fetched.totalTaxAmount))).toBe(true);
  });

  it('3. should verify listInvoices returns normalized records without NaN', async () => {
    const invoices = await listInvoices(shopId);
    expect(invoices.length).toBeGreaterThanOrEqual(2);

    for (const inv of invoices) {
      expect(Number.isFinite(parseFloat(inv.grandTotal))).toBe(true);
      expect(Number.isFinite(parseFloat(inv.finalPayable))).toBe(true);
      expect(Number.isFinite(parseFloat(inv.taxableAmount))).toBe(true);
      expect(Number.isFinite(parseFloat(inv.totalTaxAmount))).toBe(true);
      expect(inv.grandTotal).not.toContain('NaN');
      expect(inv.finalPayable).not.toContain('NaN');
    }
  });

  it('4. should verify normalizeInvoice handles sparse/null objects gracefully without throwing or producing NaN', () => {
    const rawSparseInvoice = {
      id: 'sparse-id',
      invoiceNumber: 'KJ-2026/99999',
      customerName: 'Test Customer',
      taxableAmount: '1000.00',
      // all other totals undefined
    };

    const normalized = normalizeInvoice(rawSparseInvoice, [
      { itemCode: 'ITEM-1', metalValue: '1000.00' }
    ]);

    expect(normalized).toBeDefined();
    expect(normalized.grandTotal).toBe('0.00');
    expect(normalized.finalPayable).toBe('0.00');
    expect(normalized.totalTaxAmount).toBe('0.00');
    expect(normalized.taxAmount).toBe('0.00');
    expect(normalized.oldGoldDeduction).toBe('0.00');
    expect(normalized.items[0].baseMetalValue).toBe('1000.00');
    expect(normalized.items[0].totalAmount).toBe('0.00');
  });
});
