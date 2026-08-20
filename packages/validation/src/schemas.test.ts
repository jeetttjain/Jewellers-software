import { describe, it, expect } from 'vitest';
import {
  uuidSchema,
  itemCodeSchema,
  mobileNumberSchema,
  gstinSchema,
  huidSchema,
  decimalWeightSchema,
  currencyAmountSchema,
  createJewelleryItemSchema
} from './schemas.js';
import { Metal, PurityKarat, MakingChargeType } from '@jewellery-pos/shared';

describe('Validation Foundation Schemas', () => {
  it('validates UUID correctly', () => {
    expect(uuidSchema.safeParse('123e4567-e89b-12d3-a456-426614174000').success).toBe(true);
    expect(uuidSchema.safeParse('invalid-uuid').success).toBe(false);
  });

  it('validates Item Code format', () => {
    expect(itemCodeSchema.safeParse('KJ-2026-00892').success).toBe(true);
    expect(itemCodeSchema.safeParse('RING_001').success).toBe(true);
    expect(itemCodeSchema.safeParse('AB').success).toBe(false); // < 3 chars
  });

  it('validates Indian 10-digit mobile numbers', () => {
    expect(mobileNumberSchema.safeParse('9876543210').success).toBe(true);
    expect(mobileNumberSchema.safeParse('8123456789').success).toBe(true);
    expect(mobileNumberSchema.safeParse('1234567890').success).toBe(false); // Starts with 1
    expect(mobileNumberSchema.safeParse('98765').success).toBe(false); // Short
  });

  it('validates 6-character HUID codes', () => {
    expect(huidSchema.safeParse('MH89A2').success).toBe(true);
    expect(huidSchema.safeParse('AH8921').success).toBe(true);
    expect(huidSchema.safeParse('mh89a2').success).toBe(true); // Auto-transforms to uppercase
    expect(huidSchema.safeParse('12345').success).toBe(false); // 5 chars
    expect(huidSchema.safeParse('1234567').success).toBe(false); // 7 chars
    expect(huidSchema.safeParse('MH-89A').success).toBe(false); // Special char
  });

  it('validates GSTIN structure', () => {
    expect(gstinSchema.safeParse('24AAAAA0000A1Z5').success).toBe(true);
    expect(gstinSchema.safeParse('27ABCDE1234F2Z8').success).toBe(true);
    expect(gstinSchema.safeParse('INVALIDGST').success).toBe(false);
  });

  it('enforces maximum 3 decimal places on weight fields', () => {
    expect(decimalWeightSchema.safeParse('12.450').success).toBe(true);
    expect(decimalWeightSchema.safeParse('12.4').success).toBe(true);
    expect(decimalWeightSchema.safeParse('12').success).toBe(true);
    expect(decimalWeightSchema.safeParse('12.4555').success).toBe(false); // 4 decimals
    expect(decimalWeightSchema.safeParse('0.000').success).toBe(false); // Weight > 0
  });

  it('enforces maximum 2 decimal places on currency amounts', () => {
    expect(currencyAmountSchema.safeParse('88250.50').success).toBe(true);
    expect(currencyAmountSchema.safeParse('100').success).toBe(true);
    expect(currencyAmountSchema.safeParse('100.999').success).toBe(false); // 3 decimals
  });

  it('validates jewellery item and guards against stone weight exceeding gross weight', () => {
    const validItem = {
      itemCode: 'KJ-RING-01',
      category: 'Rings',
      designTitle: 'Antique Peacock Ring',
      metal: Metal.GOLD,
      purity: PurityKarat.K22,
      grossWeight: '12.450',
      stoneWeight: '0.250',
      huid: 'MH89A2',
      hallmarkVerified: true,
      makingChargeType: MakingChargeType.PER_GRAM,
      makingChargeValue: '450.00',
      wastagePct: '0.00',
      stoneValue: '1500.00'
    };
    expect(createJewelleryItemSchema.safeParse(validItem).success).toBe(true);

    const invalidItem = {
      ...validItem,
      grossWeight: '10.000',
      stoneWeight: '12.000' // Stone > Gross
    };
    expect(createJewelleryItemSchema.safeParse(invalidItem).success).toBe(false);
  });
});
