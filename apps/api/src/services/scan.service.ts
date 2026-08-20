import { getItemByIdOrCode } from './items.service.js';
import { resolveCurrentRate } from './rates.service.js';
import { Decimal } from 'decimal.js';

export async function lookupItemWithQuote(shopId: string, codeOrId: string) {
  const item = await getItemByIdOrCode(shopId, codeOrId);
  if (!item) {
    throw new Error(`Item code '${codeOrId}' was not found in showroom inventory.`);
  }

  if (item.status === 'SOLD') {
    throw new Error(`This jewellery item (${item.itemCode}) has already been sold.`);
  }

  if (item.status !== 'IN_STOCK') {
    throw new Error(`This item (${item.itemCode}) is currently unavailable.`);
  }

  if (!item.netWeight || parseFloat(item.netWeight) <= 0) {
    throw new Error(`Pricing information is incomplete for this item (${item.itemCode}). Please check the item record.`);
  }

  // Centralized, Deterministic Rate Resolution from Rate Master
  const resolved = await resolveCurrentRate(shopId, {
    rateDefinitionId: (item as any).rateDefinitionId,
    metal: item.metal,
    purity: item.purity,
    fineness: (item as any).fineness
  });

  const rateApplied = new Decimal(resolved.rate);

  // Precise Decimal math
  const netWeight = new Decimal(item.netWeight);
  const baseMetalValue = netWeight.times(rateApplied).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

  let makingCharges = new Decimal(0);
  const mcRate = new Decimal(item.makingChargeValue);

  if (item.makingChargeType === 'PER_GRAM') {
    makingCharges = netWeight.times(mcRate).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  } else if (item.makingChargeType === 'PERCENTAGE') {
    makingCharges = baseMetalValue.times(mcRate.dividedBy(100)).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  } else {
    makingCharges = mcRate.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  }

  const wastagePct = new Decimal(item.wastagePct);
  const wastageValue = baseMetalValue.times(wastagePct.dividedBy(100)).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const stoneValue = new Decimal(item.stoneValue);

  const taxableAmount = baseMetalValue
    .plus(makingCharges)
    .plus(wastageValue)
    .plus(stoneValue)
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

  const taxPercent = new Decimal('3.00');
  const taxAmount = taxableAmount.times(taxPercent.dividedBy(100)).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const totalAmount = taxableAmount.plus(taxAmount).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

  return {
    item: {
      ...item,
      fineness: resolved.fineness,
      rateDefinitionId: resolved.rateDefinitionId
    },
    breakdown: {
      rateApplied: rateApplied.toFixed(2),
      masterRate: rateApplied.toFixed(2),
      fineness: resolved.fineness,
      baseMetalValue: baseMetalValue.toFixed(2),
      makingCharges: makingCharges.toFixed(2),
      wastageValue: wastageValue.toFixed(2),
      stoneValue: stoneValue.toFixed(2),
      taxableAmount: taxableAmount.toFixed(2),
      taxPercent: taxPercent.toFixed(2),
      taxAmount: taxAmount.toFixed(2),
      totalAmount: totalAmount.toFixed(2)
    }
  };
}
