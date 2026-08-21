import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../server.js';
import { FastifyInstance } from 'fastify';
import { getDatabase } from '../db/connection.js';
import * as schema from '../db/schema/index.js';
import { randomUUID } from 'crypto';
import { hashPassword, hashPin } from '../services/crypto.js';
import { createItem } from '../services/items.service.js';
import { updateRateDefinition } from '../services/rates.service.js';
import { lookupItemWithQuote } from '../services/scan.service.js';
import { createInvoiceTransaction } from '../services/billing.service.js';
import {
  calculateNetWeight,
  decimalMultiply,
  decimalPercentage,
  decimalAdd,
  formatCurrency,
  formatWeight,
  MakingChargeType
} from '@jewellery-pos/shared';

describe('Scan Quotation to POS Bill Integration & Valuation Preservation Test', () => {
  let app: FastifyInstance;
  let shopId: string;
  let userId: string;

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
      name: 'Kamal Jewellers Scan POS Test',
      code: `KJ_SCAN_${Date.now()}`.slice(0, 20),
      address: '104 Zaveri Bazaar',
      defaultTaxPercent: '3.00'
    });

    await db.insert(schema.users).values({
      id: userId,
      shopId,
      name: 'Showroom Cashier',
      email: `cashier_${Date.now()}@kj.com`,
      passwordHash,
      pinHash,
      role: 'ADMIN',
      isActive: true
    });

    // Create 22K rate definition of 6980.00
    await db.insert(schema.rateDefinitions).values({
      shopId,
      metal: 'GOLD',
      purity: '22K',
      fineness: 916,
      currentRate: '6980.00',
      updatedBy: userId,
      updatedByName: 'Showroom Cashier'
    });
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('1. should verify exact production scenario: Scan quotation preserves all valuation components into POS', async () => {
    // Production example item:
    // Gross: 28.350g, Stone: 0.500g, Net: 27.850g, 22K (916)
    // Rate: 6980.00/g
    // Making: 500/g (Making charges = 27.850 * 500 = 13925.00)
    // Wastage: 2% (Wastage = 194393.00 * 2% = 3887.86)
    const item = await createItem(shopId, {
      itemCode: `KJ-NECK-${Date.now()}`,
      designTitle: '22K Gold Royal Necklace',
      category: 'Necklace',
      metal: 'GOLD',
      purity: '22K',
      grossWeight: '28.350',
      stoneWeight: '0.500',
      makingChargeType: 'PER_GRAM',
      makingChargeValue: '500.00',
      wastagePct: '2.00',
      stoneValue: '0.00',
      huid: 'HUID916'
    });

    // A. Scanner Quotation
    const quote = await lookupItemWithQuote(shopId, item.itemCode);

    expect(quote.breakdown.baseMetalValue).toBe('194393.00');
    expect(quote.breakdown.makingCharges).toBe('13925.00');
    expect(quote.breakdown.wastageValue).toBe('3887.86');
    expect(quote.breakdown.taxableAmount).toBe('212205.86');
    expect(quote.breakdown.taxAmount).toBe('6366.18');
    expect(quote.breakdown.totalAmount).toBe('218572.04');

    // B. Simulate "Add to POS Bill" conversion logic with breakdown object
    const netWeight = calculateNetWeight(quote.item.grossWeight, quote.item.stoneWeight || '0.000');
    const rateStr = quote.breakdown.rateApplied;
    const baseMetalValue = decimalMultiply(netWeight, rateStr);
    const wastageValue = decimalPercentage(baseMetalValue, quote.item.wastagePct || '0');
    const makingCharges = formatCurrency(decimalMultiply(netWeight, quote.item.makingChargeValue));
    const stoneVal = formatCurrency(quote.item.stoneValue || '0');
    const taxableAmount = decimalAdd(
      decimalAdd(baseMetalValue, wastageValue),
      decimalAdd(makingCharges, stoneVal)
    );
    const taxAmount = decimalPercentage(taxableAmount, '3.00');
    const finalPrice = decimalAdd(taxableAmount, taxAmount);

    // Verify POS Cart Item math produces exact matching valuation (NOT ₹0 base metal)
    expect(formatCurrency(baseMetalValue)).toBe('194393.00');
    expect(makingCharges).toBe('13925.00');
    expect(formatCurrency(wastageValue)).toBe('3887.86');
    expect(formatCurrency(taxableAmount)).toBe('212205.86');
    expect(formatCurrency(taxAmount)).toBe('6366.18');
    expect(formatCurrency(finalPrice)).toBe('218572.04');

    // C. Verify POS Invoice Generation from this Scanned Item
    const invoice = await createInvoiceTransaction(
      {
        customerName: 'Smt. Radhika Merchant',
        customerMobile: '9820011122',
        customerPan: 'ABCDE1234F',
        items: [
          {
            itemId: item.id,
            itemCode: item.itemCode,
            designTitle: item.designTitle,
            metal: item.metal,
            purity: item.purity,
            fineness: 916,
            grossWeight: item.grossWeight,
            stoneWeight: item.stoneWeight,
            netWeight: item.netWeight,
            rateApplied: quote.breakdown.rateApplied,
            makingChargeType: item.makingChargeType,
            makingChargeValue: item.makingChargeValue,
            wastagePct: item.wastagePct,
            stoneValue: item.stoneValue,
            discount: '0.00'
          }
        ],
        payments: [
          {
            mode: 'UPI',
            amount: '218572.04'
          }
        ]
      },
      userId,
      'Showroom Cashier',
      shopId
    );

    expect(invoice.subtotalMetal).toBe('194393.00');
    expect(invoice.makingChargesTotal).toBe('13925.00');
    expect(invoice.wastageValueTotal).toBe('3887.86');
    expect(invoice.taxableAmount).toBe('212205.86');
    expect(invoice.totalTaxAmount).toBe('6366.18');
    expect(invoice.grandTotal).toBe('218572.04');
    expect(invoice.finalPayable).toBe('218572.04');
  });

  it('2. should verify zero wastage item retains complete metal value and accurate totals', async () => {
    const itemZeroWastage = await createItem(shopId, {
      itemCode: `KJ-ZERO-WASTE-${Date.now()}`,
      designTitle: '22K Gold Plain Bangle',
      category: 'Bangle',
      metal: 'GOLD',
      purity: '22K',
      grossWeight: '10.000',
      stoneWeight: '0.000',
      makingChargeType: 'PER_GRAM',
      makingChargeValue: '400.00',
      wastagePct: '0.00',
      stoneValue: '0.00'
    });

    const quote = await lookupItemWithQuote(shopId, itemZeroWastage.itemCode);

    // 10g @ 6980.00 = 69800.00
    // Making = 10 * 400 = 4000.00
    // Wastage = 0.00
    // Taxable = 73800.00
    // Tax 3% = 2214.00
    // Total = 76014.00
    expect(quote.breakdown.baseMetalValue).toBe('69800.00');
    expect(quote.breakdown.makingCharges).toBe('4000.00');
    expect(quote.breakdown.wastageValue).toBe('0.00');
    expect(quote.breakdown.taxableAmount).toBe('73800.00');
    expect(quote.breakdown.taxAmount).toBe('2214.00');
    expect(quote.breakdown.totalAmount).toBe('76014.00');
  });

  it('3. should verify item with stone/dust weight deducts stone from metal value and adds stone value', async () => {
    const itemStone = await createItem(shopId, {
      itemCode: `KJ-STONE-RING-${Date.now()}`,
      designTitle: '22K Gold Studded Cocktail Ring',
      category: 'Ring',
      metal: 'GOLD',
      purity: '22K',
      grossWeight: '15.500',
      stoneWeight: '2.500', // Net = 13.000g
      makingChargeType: 'PER_GRAM',
      makingChargeValue: '400.00', // 13.000 * 400 = 5200.00
      wastagePct: '1.00', // 13.000 * 6980 * 1% = 90740 * 1% = 907.40
      stoneValue: '3500.00'
    });

    const quote = await lookupItemWithQuote(shopId, itemStone.itemCode);

    // Net: 13.000g @ 6980.00 = 90740.00
    // Making: 5200.00
    // Wastage: 907.40
    // Stone Value: 3500.00
    // Taxable: 90740 + 5200 + 907.40 + 3500 = 100347.40
    // Tax 3%: 3010.42
    // Total: 103357.82
    expect(quote.breakdown.baseMetalValue).toBe('90740.00');
    expect(quote.breakdown.makingCharges).toBe('5200.00');
    expect(quote.breakdown.wastageValue).toBe('907.40');
    expect(quote.breakdown.stoneValue).toBe('3500.00');
    expect(quote.breakdown.taxableAmount).toBe('100347.40');
    expect(quote.breakdown.taxAmount).toBe('3010.42');
    expect(quote.breakdown.totalAmount).toBe('103357.82');
  });
});
