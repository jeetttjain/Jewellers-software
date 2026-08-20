import {
  Role,
  PaymentStatus,
  ItemStatus,
  Metal,
  PurityKarat,
  PaymentMode,
  MakingChargeType,
  ReturnRestockDestination,
  OldGoldSettlementType
} from '../enums/index.js';

export interface UserSession {
  id: string;
  shopId: string;
  name: string;
  email: string;
  role: Role;
  pinCode?: string;
}

export interface InvoiceTemplateConfig {
  paperSize: 'A4' | '80mm';
  logoVisible: boolean;
  shopNameVisible: boolean;
  addressVisible: boolean;
  gstinVisible: boolean;
  phoneVisible: boolean;
  emailVisible: boolean;
  customerNameVisible: boolean;
  customerMobileVisible: boolean;
  customerAddressVisible: boolean;
  customerPanVisible: boolean;
  customerGstinVisible: boolean;
  itemHuidVisible: boolean;
  itemBarcodeVisible: boolean;
  itemGrossWeightVisible: boolean;
  itemStoneWeightVisible: boolean;
  itemNetWeightVisible: boolean;
  itemMakingChargesVisible: boolean;
  itemWastageVisible: boolean;
  itemStoneValueVisible: boolean;
  itemDiscountVisible: boolean;
  cgstSgstBreakdownVisible: boolean;
  oldGoldDeductionVisible: boolean;
  termsVisible: boolean;
  termsText: string;
  footerText: string;
}

export interface ShopSettings {
  id: string;
  name: string;
  code: string;
  address: string;
  phone?: string;
  email?: string;
  gstin?: string;
  taxStatus: 'GST_REGISTERED' | 'NON_GST_COMPOSITION' | 'TAX_EXEMPT';
  defaultTaxPercent: string;
  invoicePrefix: string;
  printerPaperSize?: '80mm' | '58mm' | 'A4';
  termsAndConditions?: string;
  logoUrl?: string | null;
  ownerPinSet?: boolean;
  invoiceTemplate?: InvoiceTemplateConfig;
  lastBackupAt?: string | null;
}

export interface RateDefinition {
  id: string;
  shopId: string;
  metal: string;
  purity: string;
  fineness: number;
  currentRate: string;
  isActive: boolean;
  sortOrder: number;
  effectiveFrom: string;
  createdAt: string;
  updatedAt: string;
}

export interface RateHistoryEntry {
  id: string;
  shopId: string;
  rateDefinitionId?: string | null;
  metal: string;
  purity: string;
  fineness?: number | null;
  previousRate?: string | null;
  newRate: string;
  action: string;
  changedBy: string;
  changedByName?: string | null;
  effectiveFrom: string;
  createdAt: string;
}

export interface GoldRateSnapshot {
  id: string;
  shopId: string;
  rate24k: string;
  rate22k: string;
  rate18k: string;
  rateSilver: string;
  ratePlatinum?: string;
  effectiveFrom: string;
  createdBy: string;
  createdByName?: string;
}

export interface ItemImage {
  id: string;
  shopId: string;
  itemId: string;
  storagePath?: string;
  imageUrl: string;
  isPrimary: boolean;
  label: string;
  sortOrder: number;
  createdAt: string;
  updatedAt?: string;
}

export interface JewelleryItemSummary {
  id: string;
  shopId?: string;
  rateDefinitionId?: string | null;
  itemCode: string;
  category: string;
  designTitle: string;
  metal: Metal | string;
  purity: PurityKarat | string;
  fineness?: number | null;
  grossWeight: string;
  stoneWeight: string;
  netWeight: string;
  huid?: string;
  hallmarkVerified: boolean;
  makingChargeType: MakingChargeType;
  makingChargeValue: string;
  wastagePct: string;
  stoneValue: string;
  status: ItemStatus;
  imageUrl?: string | null;
  images?: ItemImage[];
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface PriceBreakdown {
  netWeight: string;
  boardRate: string;
  masterRate?: string;
  isRateOverridden?: boolean;
  baseMetalValue: string;
  makingCharges: string;
  wastageValue: string;
  stoneValue: string;
  taxableSubtotal: string;
  taxPercent: string;
  taxAmount: string;
  finalPrice: string;
}

export interface CartItem {
  id: string;
  item?: JewelleryItemSummary;
  rateDefinitionId?: string | null;
  itemCode: string;
  designTitle: string;
  category: string;
  metal: Metal | string;
  purity: PurityKarat | string;
  fineness?: number | null;
  grossWeight: string;
  stoneWeight: string;
  netWeight: string;
  huid?: string;
  boardRate: string; // The applied rate
  masterRate?: string; // The showroom rate
  isRateOverridden?: boolean;
  overrideReason?: string;
  baseMetalValue: string;
  makingChargeType: MakingChargeType;
  makingChargeValue: string;
  makingChargesTotal: string;
  wastagePct: string;
  wastageValue: string;
  stoneValue: string;
  discount: string;
  taxableAmount: string;
  taxPercent: string;
  taxAmount: string;
  finalPrice: string;
}

export interface Customer {
  id: string;
  name: string;
  mobile: string;
  email?: string;
  pan?: string;
  address?: string;
  city?: string;
  stateCode?: string;
  gstin?: string;
  ledgerBalance: string;
  totalPurchases: string;
  createdAt: string;
}

export interface CustomerLedgerEntry {
  id: string;
  customerId: string;
  date: string;
  type: 'INVOICE' | 'PAYMENT' | 'RETURN_CREDIT' | 'OLD_GOLD_CREDIT';
  referenceNo: string;
  description: string;
  debit: string;
  credit: string;
  runningBalance: string;
}

export interface PaymentTender {
  mode: PaymentMode;
  amount: string;
  referenceNo?: string;
  notes?: string;
}

export interface PaymentRecord {
  id: string;
  invoiceId?: string;
  customerId?: string;
  customerName?: string;
  amount: string;
  mode: PaymentMode;
  referenceNo?: string;
  notes?: string;
  createdAt: string;
  createdByName?: string;
}

export interface InvoiceItemRecord {
  id: string;
  invoiceId: string;
  itemId?: string;
  itemCode: string;
  designTitle: string;
  metal: Metal | string;
  purity: PurityKarat | string;
  fineness?: number | null;
  grossWeight: string;
  stoneWeight: string;
  netWeight: string;
  huid?: string;
  boardRate: string; // Applied rate
  masterRate?: string | null; // Official master rate at time of sale
  isRateOverridden?: boolean;
  overrideReason?: string | null;
  metalValue: string;
  makingCharges: string;
  wastageValue: string;
  stoneValue: string;
  discount: string;
  taxableAmount: string;
  taxPercent: string;
  taxAmount: string;
  finalAmount: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  shopId: string;
  customerId?: string;
  customerName: string;
  customerMobile: string;
  customerPan?: string;
  customerAddress?: string;
  customerGstin?: string;
  subtotal: string;
  makingChargesTotal: string;
  stoneValueTotal: string;
  discountTotal: string;
  oldGoldDeductionTotal: string;
  taxableAmount: string;
  cgstAmount: string;
  sgstAmount: string;
  igstAmount: string;
  totalTaxAmount: string;
  roundOff: string;
  grandTotal: string;
  amountPaid: string;
  balanceDue: string;
  paymentStatus: PaymentStatus;
  items: InvoiceItemRecord[];
  payments: PaymentTender[];
  notes?: string;
  createdAt: string;
  createdByName?: string;
}

export interface OldGoldTransaction {
  id: string;
  transactionNumber: string;
  customerId?: string;
  customerName: string;
  customerMobile: string;
  metal: Metal;
  grossWeight: string;
  dustStoneDeduction: string;
  netScrapWeight: string;
  testedPurityPercent: string;
  fineWeight: string;
  buybackRatePerGram: string;
  totalValuation: string;
  settlementType: OldGoldSettlementType;
  invoiceId?: string;
  notes?: string;
  createdAt: string;
  createdByName?: string;
}

export interface ReturnTransaction {
  id: string;
  returnNumber: string;
  originalInvoiceId: string;
  originalInvoiceNumber: string;
  itemId: string;
  itemCode: string;
  itemTitle: string;
  customerName: string;
  returnReason: string;
  refundAmount: string;
  deductionAmount: string;
  netRefundAmount: string;
  restockDestination: ReturnRestockDestination;
  authorizedBy: string;
  authorizerName: string;
  createdAt: string;
}

export interface AuditLogEntry {
  id: string;
  actorId: string;
  actorName: string;
  actorRole: Role;
  action: string;
  entityName: string;
  entityId: string;
  stateDiff?: Record<string, unknown>;
  ipAddress?: string;
  createdAt: string;
}

export type LabelPreset = 'SMALL_RECTANGLE' | 'MEDIUM_RECTANGLE' | 'DUMBBELL_2INCH' | 'BUTTERFLY' | 'CUSTOM';

export interface LabelTemplateConfig {
  showShopName: boolean;
  shopNameFontSizePt: number;
  shopNamePosition: 'TOP' | 'HEADER' | 'BOTTOM';
  showLogo: boolean;
  logoSize: 'SMALL' | 'MEDIUM' | 'LARGE';
  showGstin: boolean;
  showContact: boolean;
  showItemCode: boolean;
  showPurity: boolean;
  showGrossWeight: boolean;
  showStoneWeight: boolean;
  showNetWeight: boolean;
  showHuid: boolean;
  showCategory: boolean;
  showBarcode: boolean;
  barcodePosition: 'MIDDLE' | 'BOTTOM' | 'LEFT' | 'RIGHT';
  barcodeHeightMm: number;
  showHumanReadableBarcode: boolean;
  showQrCode: boolean;
  qrPosition: 'RIGHT' | 'LEFT' | 'CORNER';
  qrSizeMm: number;
  textAlignment: 'LEFT' | 'CENTER' | 'RIGHT';
  fontSizePt: number;
  marginsMm: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
}

export const DEFAULT_LABEL_CONFIG: LabelTemplateConfig = {
  showShopName: true,
  shopNameFontSizePt: 8,
  shopNamePosition: 'TOP',
  showLogo: false,
  logoSize: 'SMALL',
  showGstin: false,
  showContact: false,
  showItemCode: true,
  showPurity: true,
  showGrossWeight: true,
  showStoneWeight: false,
  showNetWeight: true,
  showHuid: true,
  showCategory: false,
  showBarcode: true,
  barcodePosition: 'BOTTOM',
  barcodeHeightMm: 8,
  showHumanReadableBarcode: true,
  showQrCode: false,
  qrPosition: 'RIGHT',
  qrSizeMm: 10,
  textAlignment: 'LEFT',
  fontSizePt: 6.5,
  marginsMm: {
    top: 1.5,
    right: 1.5,
    bottom: 1.5,
    left: 1.5
  }
};

export interface LabelTemplate {
  id: string;
  shopId: string;
  name: string;
  preset: LabelPreset;
  widthMm: string;
  heightMm: string;
  config: LabelTemplateConfig;
  isDefault: boolean;
  createdBy?: string;
  updatedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LabelQueueItem {
  id: string;
  itemId: string;
  itemCode: string;
  designTitle: string;
  metal: Metal;
  purity: PurityKarat;
  grossWeight: string;
  netWeight: string;
  huid?: string;
  makingChargeDisplay: string;
  copies: number;
  labelType: 'DUMBBELL' | 'BUTTERFLY' | 'SMALL_RECTANGLE' | 'MEDIUM_RECTANGLE';
}

export interface DashboardKPIs {
  todayRevenue: string;
  todayInvoicesCount: number;
  todayGoldWeightGrams: string;
  totalOutstandingReceivables: string;
  todayOldGoldExchangesCount: number;
  todayOldGoldValuation: string;
  totalStockItemsCount: number;
  totalStockWeightGrams: string;
  recentInvoices: Invoice[];
  hourlySales: { hour: string; amount: number; count: number }[];
  metalSalesBreakdown: { metal: string; amount: number; weight: number }[];
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    requestId?: string;
    timestamp: string;
  };
}

export interface BackupStatusResponse {
  lastBackupAt: string | null;
  status: 'UP_TO_DATE' | 'NEEDS_BACKUP' | 'NO_BACKUP';
  newChanges: number;
  estimatedBackupSizeBytes: number;
  formattedSize: string;
}

export interface BackupSummary {
  backupId: string;
  date: string;
  formattedDate: string;
  salesCount: number;
  purchasesCount: number;
  customersCount: number;
  inventoryCount: number;
  paymentsCount: number;
  returnsCount: number;
  oldGoldCount: number;
  ledgerEntriesCount: number;
  auditLogsCount: number;
  changesSinceLastBackup: number;
  backupSizeBytes: number;
  formattedSize: string;
  integrityStatus: string;
  backupType: 'FULL' | 'INCREMENTAL';
  shopId: string;
  shopName: string;
}

export interface RestoreInspectionResponse {
  success: boolean;
  summary: BackupSummary;
  schemaCompatible: boolean;
  tenantMatch: boolean;
  warning?: string;
}
