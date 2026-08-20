import { Decimal } from 'decimal.js';

export interface ComplianceConfig {
  panThreshold: Decimal;
  cashLimit: Decimal;
}

export const DEFAULT_COMPLIANCE_CONFIG: ComplianceConfig = {
  panThreshold: new Decimal('200000.00'), // ₹2,00,000 threshold for Rule 114B
  cashLimit: new Decimal('200000.00')     // Section 269ST: ₹2,00,000 limit
};

/**
 * Validates Rule 114B compliance: Transactions exceeding threshold mandate a valid PAN format.
 */
export function validateRule114B(
  grandTotal: Decimal,
  pan?: string | null,
  config = DEFAULT_COMPLIANCE_CONFIG
): { compliant: boolean; reason?: string } {
  if (grandTotal.greaterThanOrEqualTo(config.panThreshold)) {
    if (!pan || !pan.trim()) {
      return {
        compliant: false,
        reason: `Mandatory PAN required under Rule 114B for jewellery transactions of ₹${config.panThreshold.toFixed(2)} or more.`
      };
    }
    const cleanPan = pan.trim().toUpperCase();
    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
    if (!panRegex.test(cleanPan)) {
      return {
        compliant: false,
        reason: `Invalid PAN card format: '${cleanPan}'. Must be 10 alphanumeric characters (e.g. ABCDE1234F).`
      };
    }
  }
  return { compliant: true };
}

/**
 * Validates Section 269ST compliance: Single cash receipt or cumulative cash in a day must be < ₹2,00,000.
 */
export function validateSection269ST(
  cashTendered: Decimal,
  customerPriorDailyCash = new Decimal(0),
  config = DEFAULT_COMPLIANCE_CONFIG
): { compliant: boolean; reason?: string } {
  const totalCash = cashTendered.plus(customerPriorDailyCash);
  if (totalCash.greaterThanOrEqualTo(config.cashLimit)) {
    return {
      compliant: false,
      reason: `Section 269ST violation: Cash receipt cannot be ₹${config.cashLimit.toFixed(2)} or more. Current total: ₹${totalCash.toFixed(2)}. Please settle via UPI, Card, or Bank Transfer.`
    };
  }
  return { compliant: true };
}

/**
 * Dynamic Tax Split Calculation (Intra-state vs Inter-state) using Decimal.js.
 * Configured dynamically from shop default tax percent (e.g. 3.00% -> CGST 1.50% + SGST 1.50%).
 */
export function computeTaxBreakdown(
  taxableAmount: Decimal,
  taxPercentRate: Decimal | string,
  customerStateCode = '27', // Default Maharashtra
  shopStateCode = '27'
) {
  const taxPct = new Decimal(taxPercentRate);
  const totalTax = taxableAmount.times(taxPct.dividedBy(100)).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

  const isIntraState = customerStateCode === shopStateCode;

  if (isIntraState) {
    // 50-50 Split between CGST and SGST
    const halfTax = totalTax.dividedBy(2).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    const sgst = totalTax.minus(halfTax); // Guarantee exact balancing
    return {
      taxPercent: taxPct.toFixed(2),
      cgstAmount: halfTax.toFixed(2),
      sgstAmount: sgst.toFixed(2),
      igstAmount: '0.00',
      totalTaxAmount: totalTax.toFixed(2)
    };
  } else {
    // 100% IGST for Inter-State sale
    return {
      taxPercent: taxPct.toFixed(2),
      cgstAmount: '0.00',
      sgstAmount: '0.00',
      igstAmount: totalTax.toFixed(2),
      totalTaxAmount: totalTax.toFixed(2)
    };
  }
}
