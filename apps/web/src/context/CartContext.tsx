import React, { createContext, useContext, useState, useMemo } from 'react';
import { CartItem, Customer, JewelleryItemSummary, MakingChargeType, Metal, PurityKarat, OldGoldTransaction } from '@jewellery-pos/shared';
import { calculateNetWeight, decimalAdd, decimalMultiply, decimalPercentage, decimalSubtract, formatCurrency, formatWeight } from '@jewellery-pos/shared';

export interface CartTotals {
  grossWeight: number;
  netWeight: number;
  subtotalMetal: number;
  subtotalMaking: number;
  subtotalStone: number;
  discountAmount: number;
  taxableAmount: number;
  taxAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  oldGoldDeduction: number;
  roundOff: number;
  finalPayable: number;
  // String aliases for backwards compatibility
  metalValueTotal: string;
  makingChargesTotal: string;
  stoneValueTotal: string;
  discountTotal: string;
  grandTotal: string;
}

interface CartContextType {
  items: CartItem[];
  customer: Customer | null;
  addItem: (
    item: JewelleryItemSummary,
    currentRate: string,
    overrideOptions?: { isRateOverridden?: boolean; masterRate?: string; overrideReason?: string }
  ) => void;
  addCustomItem: (custom: Partial<CartItem>, currentRate: string) => void;
  removeItem: (id: string) => void;
  updateDiscount: (discountOrId: number | string, discountVal?: string) => void;
  setCustomer: (cust: Customer | null) => void;
  attachOldGoldTradeIn: (og: OldGoldTransaction | null) => void;
  clearCart: () => void;
  totals: CartTotals;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<CartItem[]>([]);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [oldGoldTradeIn, setOldGoldTradeIn] = useState<OldGoldTransaction | null>(null);
  const [cartDiscount, setCartDiscount] = useState<number>(0);

  const addItem = (
    item: JewelleryItemSummary,
    currentRate: string,
    overrideOptions?: { isRateOverridden?: boolean; masterRate?: string; overrideReason?: string }
  ) => {
    // Duplicate Item Check
    const exists = items.some((i) => i.itemCode === item.itemCode || (item.id && i.item?.id === item.id));
    if (exists) {
      throw new Error(`This item (${item.itemCode}) is already added to the bill.`);
    }

    const netWeight = calculateNetWeight(item.grossWeight, item.stoneWeight);
    const baseMetalValue = decimalMultiply(netWeight, currentRate);
    const wastageValue = decimalPercentage(baseMetalValue, item.wastagePct || '0');

    let makingCharges = '0.00';
    if (item.makingChargeType === MakingChargeType.PER_GRAM) {
      makingCharges = formatCurrency(decimalMultiply(netWeight, item.makingChargeValue));
    } else if (item.makingChargeType === MakingChargeType.PERCENTAGE) {
      makingCharges = formatCurrency(decimalPercentage(baseMetalValue, item.makingChargeValue));
    } else {
      makingCharges = formatCurrency(item.makingChargeValue);
    }

    const stoneVal = formatCurrency(item.stoneValue || '0');
    const taxableAmount = decimalAdd(
      decimalAdd(baseMetalValue, wastageValue),
      decimalAdd(makingCharges, stoneVal)
    );
    const taxPercent = '3.00';
    const taxAmount = decimalPercentage(taxableAmount, taxPercent);
    const finalPrice = decimalAdd(taxableAmount, taxAmount);

    const tempId = 'cart-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
    const masterRateVal = overrideOptions?.masterRate ? formatCurrency(overrideOptions.masterRate) : formatCurrency(currentRate);
    const isOverridden = Boolean(overrideOptions?.isRateOverridden);

    const cartItem: CartItem = {
      id: tempId,
      tempId,
      item,
      itemCode: item.itemCode,
      designTitle: item.designTitle,
      category: item.category,
      metal: item.metal,
      purity: item.purity,
      fineness: item.fineness,
      grossWeight: item.grossWeight,
      stoneWeight: item.stoneWeight || '0.000',
      netWeight: formatWeight(netWeight),
      huid: item.huid,
      boardRate: formatCurrency(currentRate),
      masterRate: masterRateVal,
      isRateOverridden: isOverridden,
      overrideReason: overrideOptions?.overrideReason,
      baseMetalValue: formatCurrency(baseMetalValue),
      makingChargeType: item.makingChargeType,
      makingChargeValue: formatCurrency(item.makingChargeValue),
      makingChargesTotal: makingCharges,
      wastagePct: item.wastagePct || '0.00',
      wastageValue: formatCurrency(wastageValue),
      stoneValue: stoneVal,
      discount: '0.00',
      taxableAmount: formatCurrency(taxableAmount),
      taxPercent,
      taxAmount: formatCurrency(taxAmount),
      finalPrice: formatCurrency(finalPrice),
      breakdown: {
        rateApplied: formatCurrency(currentRate),
        masterRate: masterRateVal,
        baseMetalValue: formatCurrency(baseMetalValue),
        makingCharges: makingCharges,
        wastageValue: formatCurrency(wastageValue),
        stoneValue: stoneVal,
        taxableAmount: formatCurrency(taxableAmount),
        taxPercent,
        taxAmount: formatCurrency(taxAmount),
      }
    };

    setItems((prev) => [...prev, cartItem]);
  };

  const addCustomItem = (custom: Partial<CartItem>, currentRate: string) => {
    const gross = custom.grossWeight || '10.000';
    const stone = custom.stoneWeight || '0.000';
    const net = formatWeight(calculateNetWeight(gross, stone));
    const metalVal = formatCurrency(decimalMultiply(net, currentRate));
    const mk = custom.makingChargesTotal || '500.00';
    const stVal = custom.stoneValue || '0.00';
    const taxable = formatCurrency(decimalAdd(metalVal, decimalAdd(mk, stVal)));
    const tax = formatCurrency(decimalPercentage(taxable, '3.00'));
    const final = formatCurrency(decimalAdd(taxable, tax));

    const tempId = 'custom-' + Date.now();
    const cartItem: CartItem = {
      id: tempId,
      tempId,
      itemCode: custom.itemCode || 'KJ-CUSTOM-' + Date.now().toString().slice(-4),
      designTitle: custom.designTitle || 'Custom Jewellery Piece',
      category: custom.category || 'Custom',
      metal: custom.metal || Metal.GOLD,
      purity: custom.purity || PurityKarat.K22,
      grossWeight: gross,
      stoneWeight: stone,
      netWeight: net,
      huid: custom.huid,
      boardRate: formatCurrency(currentRate),
      baseMetalValue: metalVal,
      makingChargeType: MakingChargeType.FLAT,
      makingChargeValue: mk,
      makingChargesTotal: mk,
      wastagePct: '0.00',
      wastageValue: '0.00',
      stoneValue: stVal,
      discount: '0.00',
      taxableAmount: taxable,
      taxPercent: '3.00',
      taxAmount: tax,
      finalPrice: final,
      breakdown: custom.breakdown || {
        rateApplied: formatCurrency(currentRate),
        baseMetalValue: metalVal,
        makingCharges: mk,
        wastageValue: '0.00',
        stoneValue: stVal,
        taxableAmount: taxable,
        taxPercent: '3.00',
        taxAmount: tax,
        totalAmount: final
      }
    };

    setItems((prev) => [...prev, cartItem]);
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const updateDiscount = (discountOrId: number | string, discountVal?: string) => {
    if (typeof discountOrId === 'number') {
      setCartDiscount(discountOrId);
    } else if (typeof discountOrId === 'string' && discountVal !== undefined) {
      setItems((prev) =>
        prev.map((it) => {
          if (it.id !== discountOrId) return it;
          const disc = formatCurrency(discountVal || '0');
          const rawTaxable = decimalSubtract(
            decimalAdd(it.baseMetalValue, decimalAdd(it.makingChargesTotal, it.stoneValue)),
            disc
          );
          const taxable = rawTaxable.greaterThan(0) ? rawTaxable : 0;
          const tax = decimalPercentage(taxable, it.taxPercent);
          const finalP = decimalAdd(taxable, tax);
          return {
            ...it,
            discount: disc,
            taxableAmount: formatCurrency(taxable),
            taxAmount: formatCurrency(tax),
            finalPrice: formatCurrency(finalP)
          };
        })
      );
    }
  };

  const clearCart = () => {
    setItems([]);
    setCustomer(null);
    setOldGoldTradeIn(null);
    setCartDiscount(0);
  };

  const totals = useMemo<CartTotals>(() => {
    let grossW = 0;
    let netW = 0;
    let metalVal = 0;
    let mkTotal = 0;
    let stTotal = 0;
    let itemDiscounts = 0;

    items.forEach((it) => {
      grossW += parseFloat(it.grossWeight) || 0;
      netW += parseFloat(it.netWeight) || 0;
      metalVal += parseFloat(it.baseMetalValue) || 0;
      mkTotal += parseFloat(it.makingChargesTotal) || 0;
      stTotal += parseFloat(it.stoneValue) || 0;
      itemDiscounts += parseFloat(it.discount) || 0;
    });

    const subtotalMetal = metalVal;
    const subtotalMaking = mkTotal;
    const subtotalStone = stTotal;
    const totalDiscount = itemDiscounts + cartDiscount;

    const baseSubtotal = subtotalMetal + subtotalMaking + subtotalStone;
    const taxableAmount = Math.max(0, baseSubtotal - totalDiscount);
    const taxAmount = taxableAmount * 0.03;
    const cgstAmount = taxAmount / 2;
    const sgstAmount = taxAmount / 2;

    const oldGoldDeduction = oldGoldTradeIn ? (parseFloat(oldGoldTradeIn.totalValuation) || 0) : 0;

    const rawGrand = taxableAmount + taxAmount - oldGoldDeduction;
    const finalPayable = Math.max(0, Math.round(rawGrand));
    const roundOff = finalPayable - rawGrand;

    return {
      grossWeight: grossW,
      netWeight: netW,
      subtotalMetal,
      subtotalMaking,
      subtotalStone,
      discountAmount: totalDiscount,
      taxableAmount,
      taxAmount,
      cgstAmount,
      sgstAmount,
      oldGoldDeduction,
      roundOff,
      finalPayable,
      metalValueTotal: subtotalMetal.toFixed(2),
      makingChargesTotal: subtotalMaking.toFixed(2),
      stoneValueTotal: subtotalStone.toFixed(2),
      discountTotal: totalDiscount.toFixed(2),
      grandTotal: finalPayable.toFixed(2)
    };
  }, [items, oldGoldTradeIn, cartDiscount]);

  return (
    <CartContext.Provider
      value={{
        items,
        customer,
        oldGoldTradeIn,
        addItem,
        addCustomItem,
        removeItem,
        updateDiscount,
        setCustomer,
        attachOldGoldTradeIn: setOldGoldTradeIn,
        clearCart,
        totals
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used within CartProvider');
  return context;
};

