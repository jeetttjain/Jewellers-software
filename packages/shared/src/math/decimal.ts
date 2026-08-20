import { Decimal } from 'decimal.js';

// Configure Decimal.js precision for financial & weight accuracy
Decimal.set({
  precision: 28,
  rounding: Decimal.ROUND_HALF_UP,
  toExpNeg: -7,
  toExpPos: 21
});

export type NumericInput = string | number | Decimal;

/**
 * Convert any valid numeric input to a Decimal instance safely without floating-point inaccuracies
 */
export function toDecimal(value: NumericInput): Decimal {
  if (value instanceof Decimal) {
    return value;
  }
  if (typeof value === 'number') {
    return new Decimal(value.toString());
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '' || isNaN(Number(trimmed))) {
      return new Decimal(0);
    }
    return new Decimal(trimmed);
  }
  return new Decimal(0);
}

/**
 * Add two values with arbitrary precision: a + b
 */
export function decimalAdd(a: NumericInput, b: NumericInput): Decimal {
  return toDecimal(a).plus(toDecimal(b));
}

/**
 * Subtract two values with arbitrary precision: a - b
 */
export function decimalSubtract(a: NumericInput, b: NumericInput): Decimal {
  return toDecimal(a).minus(toDecimal(b));
}

/**
 * Multiply two values with arbitrary precision: a * b
 */
export function decimalMultiply(a: NumericInput, b: NumericInput): Decimal {
  return toDecimal(a).times(toDecimal(b));
}

/**
 * Divide two values with arbitrary precision: a / b
 */
export function decimalDivide(a: NumericInput, b: NumericInput, precision = 6): Decimal {
  const denominator = toDecimal(b);
  if (denominator.isZero()) {
    throw new Error('Division by zero in decimal calculation');
  }
  return toDecimal(a).dividedBy(denominator).toDecimalPlaces(precision, Decimal.ROUND_HALF_UP);
}

/**
 * Calculate percentage: (value * percent) / 100
 */
export function decimalPercentage(value: NumericInput, percent: NumericInput): Decimal {
  return decimalMultiply(value, percent).dividedBy(100);
}

/**
 * Standard weight formatting for jewellery: strictly 3 decimal places (e.g. 12.450)
 */
export function formatWeight(weight: NumericInput): string {
  return toDecimal(weight).toFixed(3);
}

/**
 * Standard currency formatting for financial ledger & billing: strictly 2 decimal places (e.g. 88250.40)
 */
export function formatCurrency(amount: NumericInput): string {
  return toDecimal(amount).toFixed(2);
}

/**
 * Parse and validate net metal weight from gross and stone weights
 */
export function calculateNetWeight(grossWeight: NumericInput, stoneWeight: NumericInput): Decimal {
  const gross = toDecimal(grossWeight);
  const stone = toDecimal(stoneWeight);
  if (stone.greaterThan(gross)) {
    throw new Error('Stone weight cannot exceed gross weight');
  }
  return gross.minus(stone);
}
