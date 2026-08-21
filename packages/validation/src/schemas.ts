import { z } from 'zod';
import {
  Metal,
  PurityKarat,
  MakingChargeType,
  PaymentMode
} from '@jewellery-pos/shared';

// UUID validation
export const uuidSchema = z
  .string()
  .uuid({ message: 'Invalid UUID format' });

// Item Code (e.g. KJ-2026-00892, alphanumeric with hyphens, 3-30 chars)
export const itemCodeSchema = z
  .string()
  .trim()
  .min(3, { message: 'Item code must be at least 3 characters' })
  .max(30, { message: 'Item code cannot exceed 30 characters' })
  .regex(/^[A-Za-z0-9\-_]+$/, {
    message: 'Item code can only contain alphanumeric characters, hyphens, and underscores'
  });

// Mobile Number (Standard 10-digit Indian format or 10-15 digit international)
export const mobileNumberSchema = z
  .string()
  .trim()
  .regex(/^[6-9]\d{9}$/, {
    message: 'Mobile number must be a valid 10-digit mobile number starting with 6-9'
  });

// GSTIN format (15 characters: 2 digits state code + 10 alphanumeric PAN + 1 entity digit + 'Z' + 1 checksum)
export const gstinSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, {
    message: 'Invalid Indian GSTIN format (15 characters e.g. 24AAAAA0000A1Z5)'
  });

// HUID format: Exactly 6 alphanumeric uppercase characters (e.g. MH89A2)
export const huidSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9]{6}$/, {
    message: 'HUID must be exactly 6 alphanumeric uppercase characters (e.g. AH8921)'
  });

// Decimal Weight validation: Non-negative, max 3 decimal places (e.g. 12.450)
export const decimalWeightSchema = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,3})?$/, {
    message: 'Weight must be a positive number with at most 3 decimal places (e.g. 12.450)'
  })
  .refine((val) => parseFloat(val) > 0, {
    message: 'Weight must be strictly greater than 0'
  });

// Non-negative Decimal Weight (can be 0 for stone weight)
export const optionalDecimalWeightSchema = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,3})?$/, {
    message: 'Weight must be a valid number with at most 3 decimal places'
  });

// Currency Amount validation: Non-negative, max 2 decimal places (e.g. 88250.40)
export const currencyAmountSchema = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,2})?$/, {
    message: 'Amount must be a non-negative number with at most 2 decimal places (e.g. 1500.50)'
  });

// Login Schema
export const loginSchema = z.object({
  email: z.string().email({ message: 'Invalid email address' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters' }),
  pin: z.string().regex(/^\d{4}$/, { message: 'PIN must be a 4-digit numeric code' }).optional()
});

// Rate Definition Creation Schema (Rate Master)
export const rateDefinitionSchema = z.object({
  metal: z.string().trim().min(2, { message: 'Metal name is required' }).max(50),
  purity: z.string().trim().min(1, { message: 'Purity label is required' }).max(50),
  fineness: z.coerce.number().int().min(1, { message: 'Fineness must be at least 1' }).max(1000, { message: 'Fineness cannot exceed 1000' }),
  currentRate: currencyAmountSchema,
  isActive: z.boolean().default(true),
  sortOrder: z.coerce.number().int().default(0)
});

// Rate Definition Update Schema (Identity fields metal/purity/fineness are immutable)
export const updateRateDefinitionSchema = z.object({
  currentRate: currencyAmountSchema.optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.coerce.number().int().optional()
});

// Bulk Publish Daily Rates Schema
export const publishDailyRatesSchema = z.object({
  rates: z.array(
    z.object({
      id: uuidSchema,
      rate: currencyAmountSchema
    })
  ).min(1, { message: 'At least one rate must be provided for publishing' })
});

// Legacy Gold Board Rate update schema
export const updateGoldRateSchema = z.object({
  rate24k: currencyAmountSchema,
  rate22k: currencyAmountSchema,
  rate18k: currencyAmountSchema,
  rateSilver: currencyAmountSchema,
  ratePlatinum: currencyAmountSchema.optional(),
  effectiveFrom: z.string().datetime().optional()
});

// Jewellery Item Creation Schema (Dynamic Purity & Rate Master linked)
export const createJewelleryItemSchema = z.object({
  itemCode: itemCodeSchema,
  rateDefinitionId: uuidSchema.optional(),
  category: z.string().min(2).max(50),
  designTitle: z.string().min(2).max(100),
  metal: z.string().trim().min(2).max(50),
  purity: z.string().trim().min(1).max(50),
  fineness: z.coerce.number().int().min(1).max(1000).optional(),
  grossWeight: decimalWeightSchema,
  stoneWeight: optionalDecimalWeightSchema.default('0.000'),
  huid: huidSchema.optional().or(z.literal('')),
  hallmarkVerified: z.boolean().default(true),
  makingChargeType: z.nativeEnum(MakingChargeType).default(MakingChargeType.PER_GRAM),
  makingChargeValue: currencyAmountSchema,
  wastagePct: z.string().regex(/^\d+(\.\d{1,2})?$/).default('0.00'),
  stoneValue: currencyAmountSchema.default('0.00'),
  notes: z.string().max(500).optional()
}).refine(
  (data) => parseFloat(String(data.grossWeight)) >= parseFloat(String(data.stoneWeight)),
  {
    message: 'Gross weight must be greater than or equal to stone weight',
    path: ['grossWeight']
  }
);

// Item Image Upload Schema
export const uploadItemImageSchema = z.object({
  imageBase64: z.string().min(1, { message: 'Image data is required' }),
  label: z.string().trim().max(50).optional().default('Main'),
  isPrimary: z.boolean().optional().default(true)
});

// Payment Tender Schema
export const paymentTenderSchema = z.object({
  mode: z.nativeEnum(PaymentMode),
  amount: currencyAmountSchema,
  referenceNo: z.string().max(100).optional(),
  notes: z.string().max(255).optional()
});

// PAN validation (5 letters, 4 digits, 1 letter)
export const panSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, {
    message: 'Invalid Indian PAN format (e.g. ABCDE1234F)'
  });

// Customer Schema
export const customerSchema = z.object({
  name: z.string().trim().min(2, { message: 'Customer name is required (min 2 chars)' }).max(100),
  mobile: mobileNumberSchema,
  email: z.string().email().optional().or(z.literal('')),
  pan: panSchema.optional().or(z.literal('')),
  address: z.string().max(255).optional().or(z.literal('')),
  city: z.string().max(50).optional().or(z.literal('')),
  stateCode: z.string().max(10).optional().or(z.literal('')),
  gstin: gstinSchema.optional().or(z.literal(''))
});

// Old Gold Assay Schema
export const oldGoldAssaySchema = z.object({
  customerName: z.string().trim().min(2),
  customerMobile: mobileNumberSchema,
  metal: z.nativeEnum(Metal).default(Metal.GOLD),
  grossWeight: decimalWeightSchema,
  dustStoneDeduction: optionalDecimalWeightSchema.default('0.000'),
  testedPurityPercent: z.string().regex(/^\d+(\.\d{1,2})?$/).refine((val) => {
    const num = parseFloat(val);
    return num > 0 && num <= 100;
  }, { message: 'Purity percentage must be between 0.1 and 100' }),
  buybackRatePerGram: currencyAmountSchema,
  settlementType: z.enum(['CART_EXCHANGE', 'CASH_PAYOUT']),
  notes: z.string().max(255).optional()
});

// Return Request Schema
export const returnItemSchema = z.object({
  originalInvoiceId: z.string().min(1),
  itemId: z.string().min(1),
  returnReason: z.string().trim().min(3).max(255),
  refundAmount: currencyAmountSchema,
  deductionAmount: currencyAmountSchema.default('0.00'),
  restockDestination: z.enum(['BACK_TO_STOCK', 'MELT_VAULT']),
  supervisorPin: z.string().regex(/^\d{4}$/, { message: 'Supervisor PIN must be a 4-digit numeric code' })
});

// Create Invoice Schema
export const createInvoiceSchema = z.object({
  customerId: z.string().optional(),
  customerName: z.string().trim().min(2),
  customerMobile: mobileNumberSchema,
  customerPan: panSchema.optional().or(z.literal('')),
  customerAddress: z.string().max(255).optional().or(z.literal('')),
  customerGstin: gstinSchema.optional().or(z.literal('')),
  items: z.array(
    z.object({
      itemId: z.string().optional(),
      itemCode: z.string(),
      designTitle: z.string(),
      metal: z.nativeEnum(Metal),
      purity: z.nativeEnum(PurityKarat),
      grossWeight: decimalWeightSchema,
      stoneWeight: optionalDecimalWeightSchema,
      netWeight: decimalWeightSchema,
      huid: z.string().optional(),
      boardRate: currencyAmountSchema,
      metalValue: currencyAmountSchema,
      makingCharges: currencyAmountSchema,
      wastageValue: currencyAmountSchema.default('0.00'),
      stoneValue: currencyAmountSchema.default('0.00'),
      discount: currencyAmountSchema.default('0.00'),
      taxableAmount: currencyAmountSchema,
      taxPercent: z.string().default('3.00'),
      taxAmount: currencyAmountSchema,
      finalAmount: currencyAmountSchema
    })
  ).min(1, { message: 'Cart must contain at least 1 item' }),
  payments: z.array(paymentTenderSchema).min(1, { message: 'At least one payment tender is required' }),
  oldGoldTransactionId: z.string().optional(),
  oldGoldDeduction: currencyAmountSchema.default('0.00'),
  notes: z.string().max(500).optional()
});

// Update Shop Settings Schema
export const updateShopSettingsSchema = z.object({
  name: z.string().trim().min(2).max(150),
  address: z.string().trim().min(5),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  gstin: gstinSchema.optional().or(z.literal('')),
  taxStatus: z.enum(['GST_REGISTERED', 'NON_GST_COMPOSITION', 'TAX_EXEMPT']),
  defaultTaxPercent: z.string().regex(/^\d+(\.\d{1,2})?$/),
  invoicePrefix: z.string().min(1).max(10),
  printerPaperSize: z.enum(['80mm', '58mm', 'A4']).optional(),
  termsAndConditions: z.string().max(1000).optional()
});

// Schema Aliases for consistent API route validation
export const createCustomerSchema = customerSchema;
export const updateRatesSchema = updateGoldRateSchema;
export const createOldGoldSchema = oldGoldAssaySchema;
export const createReturnSchema = z.object({
  originalInvoiceNumber: z.string().min(1),
  itemCode: z.string().min(1),
  returnReason: z.string().trim().min(3).max(255),
  refundAmount: currencyAmountSchema,
  deductionAmount: currencyAmountSchema.default('0.00'),
  restockDestination: z.enum(['BACK_TO_STOCK', 'MELT_VAULT']),
  supervisorPin: z.string().regex(/^\d{4}$/, { message: 'Supervisor PIN must be a 4-digit numeric code' })
});

export const labelMarginsSchema = z.object({
  top: z.number().min(0).max(20),
  right: z.number().min(0).max(20),
  bottom: z.number().min(0).max(20),
  left: z.number().min(0).max(20)
});

export const labelTemplateConfigSchema = z.object({
  showShopName: z.boolean().default(true),
  shopNameFontSizePt: z.number().min(5).max(18).default(8),
  shopNamePosition: z.enum(['TOP', 'HEADER', 'BOTTOM']).default('TOP'),
  showLogo: z.boolean().default(false),
  logoSize: z.enum(['SMALL', 'MEDIUM', 'LARGE']).default('SMALL'),
  showGstin: z.boolean().default(false),
  showContact: z.boolean().default(false),
  showItemCode: z.boolean().default(true),
  showPurity: z.boolean().default(true),
  showGrossWeight: z.boolean().default(true),
  showStoneWeight: z.boolean().default(false),
  showNetWeight: z.boolean().default(true),
  showHuid: z.boolean().default(true),
  showCategory: z.boolean().default(false),
  showBarcode: z.boolean().default(true),
  barcodePosition: z.enum(['MIDDLE', 'BOTTOM', 'LEFT', 'RIGHT']).default('BOTTOM'),
  barcodeHeightMm: z.number().min(4).max(25).default(8),
  showHumanReadableBarcode: z.boolean().default(true),
  showQrCode: z.boolean().default(false),
  qrPosition: z.enum(['RIGHT', 'LEFT', 'CORNER']).default('RIGHT'),
  qrSizeMm: z.number().min(5).max(30).default(10),
  textAlignment: z.enum(['LEFT', 'CENTER', 'RIGHT']).default('LEFT'),
  fontSizePt: z.number().min(4).max(14).default(6.5),
  marginsMm: labelMarginsSchema.default({ top: 1.5, right: 1.5, bottom: 1.5, left: 1.5 })
});

export const updateLabelTemplateSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  preset: z.enum(['SMALL_RECTANGLE', 'MEDIUM_RECTANGLE', 'DUMBBELL_2INCH', 'BUTTERFLY', 'CUSTOM']).default('SMALL_RECTANGLE'),
  widthMm: z.string().regex(/^\d+(\.\d{1,2})?$/).default('50.00'),
  heightMm: z.string().regex(/^\d+(\.\d{1,2})?$/).default('25.00'),
  config: labelTemplateConfigSchema
});

// Owner 6-digit PIN schema (strictly 6 numeric digits)
export const ownerPinSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, {
    message: 'Owner PIN must consist of exactly 6 numeric digits'
  });

export const invoiceTemplateSchema = z.object({
  paperSize: z.enum(['A4', '80mm']).default('A4'),
  logoVisible: z.boolean().default(true),
  shopNameVisible: z.boolean().default(true),
  addressVisible: z.boolean().default(true),
  gstinVisible: z.boolean().default(true),
  phoneVisible: z.boolean().default(true),
  emailVisible: z.boolean().default(true),
  customerNameVisible: z.boolean().default(true),
  customerMobileVisible: z.boolean().default(true),
  customerAddressVisible: z.boolean().default(true),
  customerPanVisible: z.boolean().default(true),
  customerGstinVisible: z.boolean().default(true),
  itemHuidVisible: z.boolean().default(true),
  itemBarcodeVisible: z.boolean().default(true),
  itemGrossWeightVisible: z.boolean().default(true),
  itemStoneWeightVisible: z.boolean().default(true),
  itemNetWeightVisible: z.boolean().default(true),
  itemMakingChargesVisible: z.boolean().default(true),
  itemWastageVisible: z.boolean().default(true),
  itemStoneValueVisible: z.boolean().default(true),
  itemDiscountVisible: z.boolean().default(true),
  cgstSgstBreakdownVisible: z.boolean().default(true),
  oldGoldDeductionVisible: z.boolean().default(true),
  termsVisible: z.boolean().default(true),
  termsText: z.string().max(2000).default('1. Goods once sold will be exchanged as per store policy.\n2. All disputes subject to local jurisdiction.'),
  footerText: z.string().max(500).default('Thank you for shopping with us!')
});

// Supplier Master Validation Schemas
export const createSupplierSchema = z.object({
  name: z.string().trim().min(2, { message: 'Supplier name must be at least 2 characters' }).max(150),
  supplierCode: z.string().trim().min(2, { message: 'Supplier code is required' }).max(50),
  mobile: mobileNumberSchema,
  email: z.string().trim().email({ message: 'Invalid email address' }).optional().or(z.literal('')),
  pan: panSchema.optional().or(z.literal('')),
  gstin: gstinSchema.optional().or(z.literal('')),
  address: z.string().trim().max(500).optional(),
  city: z.string().trim().max(100).optional(),
  state: z.string().trim().max(100).optional(),
  stateCode: z.string().trim().max(10).optional(),
  paymentTermsDays: z.coerce.number().int().min(0).max(365).default(30),
  openingBalance: currencyAmountSchema.default('0.00'),
  notes: z.string().trim().max(1000).optional()
});

export const updateSupplierSchema = createSupplierSchema.partial().extend({
  isActive: z.boolean().optional()
});

// Purchase Line Item Schema
export const createPurchaseItemSchema = z.object({
  itemId: uuidSchema.optional(),
  itemCode: itemCodeSchema,
  category: z.string().trim().min(2).max(50),
  designTitle: z.string().trim().min(2).max(150),
  metal: z.string().trim().min(2).max(50).default('GOLD'),
  purity: z.string().trim().min(1).max(50),
  fineness: z.coerce.number().int().min(1).max(1000).optional(),
  grossWeight: decimalWeightSchema,
  stoneWeight: optionalDecimalWeightSchema.default('0.000'),
  netWeight: decimalWeightSchema,
  pureWeight: optionalDecimalWeightSchema.default('0.000'),
  purchaseRate: currencyAmountSchema,
  benchmarkRate: currencyAmountSchema.optional(),
  metalCost: currencyAmountSchema,
  makingChargeType: z.nativeEnum(MakingChargeType).default(MakingChargeType.PER_GRAM),
  makingRate: currencyAmountSchema.default('0.00'),
  makingCost: currencyAmountSchema.default('0.00'),
  wastagePct: z.string().regex(/^\d+(\.\d{1,2})?$/).default('0.00'),
  wastageValue: currencyAmountSchema.default('0.00'),
  stoneValue: currencyAmountSchema.default('0.00'),
  taxableAmount: currencyAmountSchema,
  taxAmount: currencyAmountSchema.default('0.00'),
  finalAmount: currencyAmountSchema,
  huid: huidSchema.optional().or(z.literal('')),
  autoCreateStock: z.boolean().default(true)
}).refine(
  (data) => parseFloat(String(data.grossWeight)) >= parseFloat(String(data.stoneWeight)),
  {
    message: 'Gross weight must be greater than or equal to stone weight',
    path: ['grossWeight']
  }
);

// Purchase Payment Tender Schema
export const createPurchasePaymentSchema = z.object({
  amount: currencyAmountSchema,
  mode: z.nativeEnum(PaymentMode),
  referenceNo: z.string().trim().max(100).optional(),
  notes: z.string().trim().max(500).optional()
});

// Purchase Creation Schema
export const createPurchaseSchema = z.object({
  supplierId: uuidSchema,
  supplierInvoiceNumber: z.string().trim().max(100).optional(),
  purchaseDate: z.string().datetime().optional(),
  otherCharges: currencyAmountSchema.default('0.00'),
  discountTotal: currencyAmountSchema.default('0.00'),
  taxPercent: z.string().regex(/^\d+(\.\d{1,2})?$/).default('3.00'),
  notes: z.string().trim().max(1000).optional(),
  items: z.array(createPurchaseItemSchema).min(1, { message: 'At least one purchase item is required' }),
  payments: z.array(createPurchasePaymentSchema).default([]),
  idempotencyKey: z.string().trim().max(255).optional()
});

// Record Standalone Supplier Payment Schema
export const recordSupplierPaymentSchema = z.object({
  purchaseId: uuidSchema.optional(),
  amount: currencyAmountSchema,
  mode: z.nativeEnum(PaymentMode),
  referenceNo: z.string().trim().max(100).optional(),
  notes: z.string().trim().max(500).optional(),
  idempotencyKey: z.string().trim().max(255).optional()
});

// Purchase Return Schema
export const purchaseReturnSchema = z.object({
  originalPurchaseId: uuidSchema.optional(),
  supplierId: uuidSchema,
  reason: z.string().trim().min(3, { message: 'Return reason is required' }).max(500),
  supervisorPin: z.string().regex(/^\d{4,6}$/, { message: 'Supervisor PIN is required' }),
  items: z.array(
    z.object({
      itemId: uuidSchema.optional(),
      itemCode: itemCodeSchema,
      grossWeight: decimalWeightSchema,
      netWeight: decimalWeightSchema,
      returnRate: currencyAmountSchema,
      returnAmount: currencyAmountSchema
    })
  ).min(1, { message: 'At least one return item is required' })
});



