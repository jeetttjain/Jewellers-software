import { describe, it, expect } from 'vitest';
import {
  decimalAdd,
  decimalSubtract,
  decimalMultiply,
  decimalDivide,
  decimalPercentage,
  formatWeight,
  formatCurrency,
  calculateNetWeight
} from './decimal.js';

describe('Precision Math Foundation (Decimal.js)', () => {
  it('solves classic floating point arithmetic errors (0.1 + 0.2 === 0.3)', () => {
    // JavaScript standard: 0.1 + 0.2 = 0.30000000000000004
    const result = decimalAdd('0.1', '0.2');
    expect(result.toString()).toBe('0.3');
  });

  it('correctly adds milligram jewellery weights without precision loss', () => {
    const w1 = '12.455';
    const w2 = '0.005';
    const total = decimalAdd(w1, w2);
    expect(formatWeight(total)).toBe('12.460');
  });

  it('correctly calculates net gold weight (Gross - Stone)', () => {
    const gross = '24.560';
    const stone = '1.120';
    const net = calculateNetWeight(gross, stone);
    expect(formatWeight(net)).toBe('23.440');
  });

  it('throws error when stone weight exceeds gross weight', () => {
    expect(() => calculateNetWeight('10.000', '10.500')).toThrow(
      'Stone weight cannot exceed gross weight'
    );
  });

  it('correctly calculates making charges and GST percentages', () => {
    // Base metal: 12.200g * 6450 = 78690.00
    const metalVal = decimalMultiply('12.200', '6450');
    expect(formatCurrency(metalVal)).toBe('78690.00');

    // Making: 12.200g * 450 = 5490.00
    const making = decimalMultiply('12.200', '450');
    expect(formatCurrency(making)).toBe('5490.00');

    // Subtotal: 78690 + 5490 + 1500 = 85680.00
    const subtotal = decimalAdd(decimalAdd(metalVal, making), '1500');
    expect(formatCurrency(subtotal)).toBe('85680.00');

    // GST 3%: 85680 * 0.03 = 2570.40
    const gst = decimalPercentage(subtotal, '3');
    expect(formatCurrency(gst)).toBe('2570.40');

    // Total: 85680 + 2570.40 = 88250.40
    const total = decimalAdd(subtotal, gst);
    expect(formatCurrency(total)).toBe('88250.40');
  });

  it('correctly handles division and throws on division by zero', () => {
    const divided = decimalDivide('100', '3', 4);
    expect(divided.toString()).toBe('33.3333');

    expect(() => decimalDivide('100', '0')).toThrow('Division by zero in decimal calculation');
  });
});
