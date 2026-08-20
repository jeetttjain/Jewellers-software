import { 
  Role, 
  ItemStatus, 
  Metal, 
  PurityKarat, 
  MakingChargeType, 
  PaymentMode, 
  PaymentStatus,
  ReturnRestockDestination,
  OldGoldSettlementType,
  UserSession,
  ShopSettings,
  GoldRateSnapshot,
  JewelleryItemSummary,
  Customer,
  CustomerLedgerEntry,
  Invoice,
  PaymentRecord,
  OldGoldTransaction,
  ReturnTransaction,
  AuditLogEntry
} from '@jewellery-pos/shared';

export interface DBStore {
  shop: ShopSettings;
  users: Array<UserSession & { password: string }>;
  goldRates: GoldRateSnapshot[];
  items: JewelleryItemSummary[];
  customers: Customer[];
  ledgerEntries: CustomerLedgerEntry[];
  invoices: Invoice[];
  payments: PaymentRecord[];
  oldGoldTransactions: OldGoldTransaction[];
  returns: ReturnTransaction[];
  auditLogs: AuditLogEntry[];
}

export const initialStore: DBStore = {
  shop: {
    id: 'shop-kj-main-001',
    name: 'Kamal Jewellers — Flagship Showroom',
    code: 'KJ-MAIN',
    address: '104, Zaveri Bazaar, M.G. Road, Mumbai, Maharashtra - 400002',
    phone: '+91 98200 12345',
    email: 'contact@kamaljewellers.com',
    gstin: '27AAAAA0000A1Z5',
    taxStatus: 'GST_REGISTERED',
    defaultTaxPercent: '3.00',
    invoicePrefix: 'KJ-2026/',
    printerPaperSize: '80mm',
    termsAndConditions: '1. All gold items hallmarked with BIS HUID.\n2. Making charges are non-refundable on return.\n3. Returns accepted within 7 days with original invoice.'
  },
  users: [
    {
      id: 'usr-admin-01',
      shopId: 'shop-kj-main-001',
      name: 'Kamal Kishore Soni (Owner)',
      email: 'admin@kamaljewellers.com',
      role: Role.ADMIN,
      pinCode: '1234',
      password: 'password123'
    },
    {
      id: 'usr-mgr-02',
      shopId: 'shop-kj-main-001',
      name: 'Rajesh Verma (Floor Manager)',
      email: 'manager@kamaljewellers.com',
      role: Role.MANAGER,
      pinCode: '5678',
      password: 'password123'
    },
    {
      id: 'usr-clk-03',
      shopId: 'shop-kj-main-001',
      name: 'Pooja Sharma (Senior Cashier)',
      email: 'cashier@kamaljewellers.com',
      role: Role.CLERK,
      pinCode: '9999',
      password: 'password123'
    }
  ],
  goldRates: [
    {
      id: 'rate-today-01',
      shopId: 'shop-kj-main-001',
      rate24k: '7450.00',
      rate22k: '6980.00',
      rate18k: '5720.00',
      rateSilver: '88.50',
      ratePlatinum: '3150.00',
      effectiveFrom: new Date().toISOString(),
      createdBy: 'usr-admin-01',
      createdByName: 'Kamal Kishore Soni (Owner)'
    },
    {
      id: 'rate-yesterday-02',
      shopId: 'shop-kj-main-001',
      rate24k: '7410.00',
      rate22k: '6940.00',
      rate18k: '5690.00',
      rateSilver: '87.80',
      ratePlatinum: '3140.00',
      effectiveFrom: new Date(Date.now() - 86400000).toISOString(),
      createdBy: 'usr-admin-01',
      createdByName: 'Kamal Kishore Soni (Owner)'
    }
  ],
  items: [
    {
      id: 'item-001',
      itemCode: 'KJ-GLD-NK-001',
      category: 'Necklace',
      designTitle: '22K Royal Kundan Bridal Haar',
      metal: Metal.GOLD,
      purity: PurityKarat.K22,
      grossWeight: '45.850',
      stoneWeight: '3.200',
      netWeight: '42.650',
      huid: 'AH8921',
      hallmarkVerified: true,
      makingChargeType: MakingChargeType.PER_GRAM,
      makingChargeValue: '480.00',
      wastagePct: '2.50',
      stoneValue: '12500.00',
      status: ItemStatus.IN_STOCK,
      notes: 'Handcrafted Kundan setting with unheated pearls',
      createdAt: new Date(Date.now() - 50000000).toISOString()
    },
    {
      id: 'item-002',
      itemCode: 'KJ-GLD-BG-002',
      category: 'Bangles',
      designTitle: '22K Calcutta Filigree Bangle Pair',
      metal: Metal.GOLD,
      purity: PurityKarat.K22,
      grossWeight: '32.400',
      stoneWeight: '0.000',
      netWeight: '32.400',
      huid: 'MH44B1',
      hallmarkVerified: true,
      makingChargeType: MakingChargeType.PER_GRAM,
      makingChargeValue: '420.00',
      wastagePct: '1.80',
      stoneValue: '0.00',
      status: ItemStatus.IN_STOCK,
      notes: 'Standard 2.6 size pair',
      createdAt: new Date(Date.now() - 60000000).toISOString()
    },
    {
      id: 'item-003',
      itemCode: 'KJ-GLD-RG-003',
      category: 'Rings',
      designTitle: '18K Diamond Solitaire Cocktail Ring',
      metal: Metal.GOLD,
      purity: PurityKarat.K18,
      grossWeight: '6.850',
      stoneWeight: '0.450',
      netWeight: '6.400',
      huid: 'DL99C3',
      hallmarkVerified: true,
      makingChargeType: MakingChargeType.FLAT,
      makingChargeValue: '4500.00',
      wastagePct: '0.00',
      stoneValue: '35000.00',
      status: ItemStatus.IN_STOCK,
      notes: '0.75ct VVS1 certified central diamond',
      createdAt: new Date(Date.now() - 70000000).toISOString()
    },
    {
      id: 'item-004',
      itemCode: 'KJ-GLD-CH-004',
      category: 'Chains',
      designTitle: '22K Italian Machine Rope Chain',
      metal: Metal.GOLD,
      purity: PurityKarat.K22,
      grossWeight: '18.250',
      stoneWeight: '0.000',
      netWeight: '18.250',
      huid: 'RJ12X8',
      hallmarkVerified: true,
      makingChargeType: MakingChargeType.PERCENTAGE,
      makingChargeValue: '9.50',
      wastagePct: '1.00',
      stoneValue: '0.00',
      status: ItemStatus.IN_STOCK,
      notes: '22-inch high tensile strength rope chain',
      createdAt: new Date(Date.now() - 80000000).toISOString()
    },
    {
      id: 'item-005',
      itemCode: 'KJ-GLD-ER-005',
      category: 'Earrings',
      designTitle: '22K Traditional Peacock Jhumkas',
      metal: Metal.GOLD,
      purity: PurityKarat.K22,
      grossWeight: '14.620',
      stoneWeight: '0.800',
      netWeight: '13.820',
      huid: 'GJ77M4',
      hallmarkVerified: true,
      makingChargeType: MakingChargeType.PER_GRAM,
      makingChargeValue: '550.00',
      wastagePct: '2.00',
      stoneValue: '3200.00',
      status: ItemStatus.IN_STOCK,
      notes: 'Ruby embedded with hanging pearls',
      createdAt: new Date(Date.now() - 90000000).toISOString()
    },
    {
      id: 'item-006',
      itemCode: 'KJ-GLD-CN-006',
      category: 'Coins',
      designTitle: '24K 10g Laxmi-Ganesh Fine Gold Coin',
      metal: Metal.GOLD,
      purity: PurityKarat.K24,
      grossWeight: '10.000',
      stoneWeight: '0.000',
      netWeight: '10.000',
      huid: 'MM99P1',
      hallmarkVerified: true,
      makingChargeType: MakingChargeType.FLAT,
      makingChargeValue: '850.00',
      wastagePct: '0.00',
      stoneValue: '0.00',
      status: ItemStatus.IN_STOCK,
      notes: 'Tamper-proof blister packaging with 999 certification',
      createdAt: new Date(Date.now() - 100000000).toISOString()
    },
    {
      id: 'item-007',
      itemCode: 'KJ-SLV-TH-007',
      category: 'Silver Utensils',
      designTitle: '925 Fine Silver Royal Aarti Puja Thali',
      metal: Metal.SILVER,
      purity: PurityKarat.SILVER_925,
      grossWeight: '350.000',
      stoneWeight: '0.000',
      netWeight: '350.000',
      huid: 'SL88K2',
      hallmarkVerified: true,
      makingChargeType: MakingChargeType.PER_GRAM,
      makingChargeValue: '18.00',
      wastagePct: '0.00',
      stoneValue: '0.00',
      status: ItemStatus.IN_STOCK,
      notes: 'Includes diya, bell, and agarbatti stand',
      createdAt: new Date(Date.now() - 110000000).toISOString()
    },
    {
      id: 'item-008',
      itemCode: 'KJ-GLD-KD-008',
      category: 'Kada',
      designTitle: '22K Lion Face Rajputi Kada',
      metal: Metal.GOLD,
      purity: PurityKarat.K22,
      grossWeight: '48.200',
      stoneWeight: '0.000',
      netWeight: '48.200',
      huid: 'RJ55T9',
      hallmarkVerified: true,
      makingChargeType: MakingChargeType.PER_GRAM,
      makingChargeValue: '450.00',
      wastagePct: '2.00',
      stoneValue: '0.00',
      status: ItemStatus.IN_STOCK,
      notes: 'Solid screw locking mechanism',
      createdAt: new Date(Date.now() - 120000000).toISOString()
    }
  ],
  customers: [
    {
      id: 'cust-001',
      name: 'Vikramaditya Singhania',
      mobile: '9820199887',
      email: 'vikram.singhania@gmail.com',
      pan: 'ABCPS1234F',
      address: 'Penthouse 14B, Sea Face Towers, Worli, Mumbai',
      city: 'Mumbai',
      stateCode: '27',
      gstin: '27ABCPS1234F1Z1',
      ledgerBalance: '0.00',
      totalPurchases: '584200.00',
      createdAt: new Date(Date.now() - 900000000).toISOString()
    },
    {
      id: 'cust-002',
      name: 'Sunita Mehra',
      mobile: '9819283746',
      email: 'sunita.mehra@yahoo.co.in',
      pan: 'ABCPM5678G',
      address: 'Flat 402, Shanti Kunj, Linking Road, Bandra West',
      city: 'Mumbai',
      stateCode: '27',
      ledgerBalance: '15000.00',
      totalPurchases: '245600.00',
      createdAt: new Date(Date.now() - 800000000).toISOString()
    },
    {
      id: 'cust-003',
      name: 'Anand Kumar Agarwal',
      mobile: '9769012345',
      email: 'anand.agarwal@outlook.com',
      pan: 'AAAPA9012K',
      address: '22, Gulmohar Road, Juhu Scheme, Vile Parle',
      city: 'Mumbai',
      stateCode: '27',
      ledgerBalance: '0.00',
      totalPurchases: '189000.00',
      createdAt: new Date(Date.now() - 700000000).toISOString()
    }
  ],
  ledgerEntries: [
    {
      id: 'led-001',
      customerId: 'cust-002',
      date: new Date(Date.now() - 200000000).toISOString(),
      type: 'INVOICE',
      referenceNo: 'KJ-2026/00102',
      description: 'Purchase of 22K Bangles (Partially Paid)',
      debit: '115000.00',
      credit: '100000.00',
      runningBalance: '15000.00'
    }
  ],
  invoices: [
    {
      id: 'inv-00101',
      invoiceNumber: 'KJ-2026/00101',
      shopId: 'shop-kj-main-001',
      customerId: 'cust-001',
      customerName: 'Vikramaditya Singhania',
      customerMobile: '9820199887',
      customerPan: 'ABCPS1234F',
      customerAddress: 'Penthouse 14B, Sea Face Towers, Worli, Mumbai',
      customerGstin: '27ABCPS1234F1Z1',
      subtotal: '298500.00',
      makingChargesTotal: '20472.00',
      stoneValueTotal: '12500.00',
      discountTotal: '2000.00',
      oldGoldDeductionTotal: '0.00',
      taxableAmount: '329472.00',
      cgstAmount: '4942.08',
      sgstAmount: '4942.08',
      igstAmount: '0.00',
      totalTaxAmount: '9884.16',
      roundOff: '0.84',
      grandTotal: '339357.00',
      amountPaid: '339357.00',
      balanceDue: '0.00',
      paymentStatus: PaymentStatus.PAID,
      items: [
        {
          id: 'inv-item-001',
          invoiceId: 'inv-00101',
          itemId: 'item-001',
          itemCode: 'KJ-GLD-NK-001',
          designTitle: '22K Royal Kundan Bridal Haar',
          metal: Metal.GOLD,
          purity: PurityKarat.K22,
          grossWeight: '45.850',
          stoneWeight: '3.200',
          netWeight: '42.650',
          huid: 'AH8921',
          boardRate: '6980.00',
          metalValue: '297697.00',
          makingCharges: '20472.00',
          wastageValue: '7442.43',
          stoneValue: '12500.00',
          discount: '2000.00',
          taxableAmount: '329472.00',
          taxPercent: '3.00',
          taxAmount: '9884.16',
          finalAmount: '339357.00'
        }
      ],
      payments: [
        {
          mode: PaymentMode.UPI,
          amount: '200000.00',
          referenceNo: 'UPI/HDFC/678912345678'
        },
        {
          mode: PaymentMode.CARD_CREDIT,
          amount: '139357.00',
          referenceNo: 'TXN-ICICI-889921'
        }
      ],
      createdAt: new Date(Date.now() - 3600000 * 4).toISOString(),
      createdByName: 'Pooja Sharma (Senior Cashier)'
    }
  ],
  payments: [
    {
      id: 'pay-001',
      invoiceId: 'inv-00101',
      customerId: 'cust-001',
      customerName: 'Vikramaditya Singhania',
      amount: '200000.00',
      mode: PaymentMode.UPI,
      referenceNo: 'UPI/HDFC/678912345678',
      notes: 'Settled via Google Pay QR',
      createdAt: new Date(Date.now() - 3600000 * 4).toISOString(),
      createdByName: 'Pooja Sharma (Senior Cashier)'
    },
    {
      id: 'pay-002',
      invoiceId: 'inv-00101',
      customerId: 'cust-001',
      customerName: 'Vikramaditya Singhania',
      amount: '139357.00',
      mode: PaymentMode.CARD_CREDIT,
      referenceNo: 'TXN-ICICI-889921',
      notes: 'HDFC Infinia POS terminal swiped',
      createdAt: new Date(Date.now() - 3600000 * 4).toISOString(),
      createdByName: 'Pooja Sharma (Senior Cashier)'
    }
  ],
  oldGoldTransactions: [
    {
      id: 'og-001',
      transactionNumber: 'OG-2026/00045',
      customerId: 'cust-003',
      customerName: 'Anand Kumar Agarwal',
      customerMobile: '9769012345',
      metal: Metal.GOLD,
      grossWeight: '24.500',
      dustStoneDeduction: '0.800',
      netScrapWeight: '23.700',
      testedPurityPercent: '88.50',
      fineWeight: '20.975',
      buybackRatePerGram: '7450.00',
      totalValuation: '156260.00',
      settlementType: OldGoldSettlementType.CART_EXCHANGE,
      notes: 'Old 20K traditional melt scrap',
      createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
      createdByName: 'Kamal Kishore Soni (Owner)'
    }
  ],
  returns: [
    {
      id: 'ret-001',
      returnNumber: 'RET-2026/00012',
      originalInvoiceId: 'inv-00089',
      originalInvoiceNumber: 'KJ-2026/00089',
      itemId: 'item-ret-01',
      itemCode: 'KJ-GLD-RG-099',
      itemTitle: '22K Men Gold Ring',
      customerName: 'Ramesh Gupta',
      returnReason: 'Size fitting issue, exchanged for chain',
      refundAmount: '48500.00',
      deductionAmount: '1200.00',
      netRefundAmount: '47300.00',
      restockDestination: ReturnRestockDestination.BACK_TO_STOCK,
      authorizedBy: 'usr-admin-01',
      authorizerName: 'Kamal Kishore Soni (Owner)',
      createdAt: new Date(Date.now() - 86400000 * 3).toISOString()
    }
  ],
  auditLogs: [
    {
      id: 'aud-001',
      actorId: 'usr-admin-01',
      actorName: 'Kamal Kishore Soni (Owner)',
      actorRole: Role.ADMIN,
      action: 'RATE_UPDATE',
      entityName: 'GoldRate',
      entityId: 'rate-today-01',
      stateDiff: { rate24k: '7450.00', rate22k: '6980.00', delta: '+40.00/g' },
      ipAddress: '192.168.1.100',
      createdAt: new Date().toISOString()
    },
    {
      id: 'aud-002',
      actorId: 'usr-clk-03',
      actorName: 'Pooja Sharma (Senior Cashier)',
      actorRole: Role.CLERK,
      action: 'INVOICE_GENERATED',
      entityName: 'Invoice',
      entityId: 'inv-00101',
      stateDiff: { invoiceNumber: 'KJ-2026/00101', grandTotal: '339357.00', status: 'PAID' },
      ipAddress: '192.168.1.105',
      createdAt: new Date(Date.now() - 3600000 * 4).toISOString()
    }
  ]
};

export const memoryStore: DBStore = JSON.parse(JSON.stringify(initialStore));
