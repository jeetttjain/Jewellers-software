export enum Role {
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  CLERK = 'CLERK'
}

export enum PaymentStatus {
  PAID = 'PAID',
  PARTIALLY_PAID = 'PARTIALLY_PAID',
  UNPAID = 'UNPAID'
}

export enum ItemStatus {
  IN_STOCK = 'IN_STOCK',
  SOLD = 'SOLD',
  RETURNED_TO_VAULT = 'RETURNED_TO_VAULT',
  MELTED = 'MELTED'
}

export enum Metal {
  GOLD = 'GOLD',
  SILVER = 'SILVER',
  PLATINUM = 'PLATINUM'
}

export enum PurityKarat {
  K24 = '24K',
  K22 = '22K',
  K18 = '18K',
  K14 = '14K',
  SILVER_999 = '999',
  SILVER_925 = '925',
  PLAT_950 = '950'
}

export enum PaymentMode {
  CASH = 'CASH',
  UPI = 'UPI',
  CARD_DEBIT = 'CARD_DEBIT',
  CARD_CREDIT = 'CARD_CREDIT',
  BANK_TRANSFER = 'BANK_TRANSFER',
  OLD_GOLD_EXCHANGE = 'OLD_GOLD_EXCHANGE',
  CUSTOMER_LEDGER_CREDIT = 'CUSTOMER_LEDGER_CREDIT'
}

export enum MakingChargeType {
  PER_GRAM = 'PER_GRAM',
  PERCENTAGE = 'PERCENTAGE',
  FLAT = 'FLAT'
}

export enum ReturnRestockDestination {
  BACK_TO_STOCK = 'BACK_TO_STOCK',
  MELT_VAULT = 'MELT_VAULT'
}

export enum OldGoldSettlementType {
  CART_EXCHANGE = 'CART_EXCHANGE',
  CASH_PAYOUT = 'CASH_PAYOUT'
}
