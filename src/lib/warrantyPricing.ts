import { productPrice, type PriceTier } from "@/lib/format";
import type { Product } from "@/types";

export function warrantyCredit(originalUnitPrice: number, returnQty: number) {
  return originalUnitPrice * returnQty;
}

export function warrantyReplacementTotal(
  product: Product,
  qty: number,
  tier: PriceTier
) {
  return productPrice(product, tier) * qty;
}

export function suggestedDifferenceCharge(
  originalUnitPrice: number,
  returnQty: number,
  replacement: Product,
  replacementQty: number,
  tier: PriceTier
): number {
  return computeWarrantyExchangeBreakdown(
    originalUnitPrice,
    returnQty,
    replacement,
    replacementQty,
    tier
  ).extraDue;
}

export type WarrantyExchangeBreakdown = {
  credit: number;
  newTotal: number;
  /** Precio nuevo − lo pagado en la venta (puede ser negativo). */
  diff: number;
  extraDue: number;
  creditToCustomer: number;
};

/** Qué lista del catálogo coincide con lo que pagó en la venta. */
export function suggestPriceTierForPaidUnit(
  paidUnit: number,
  product: Product
): PriceTier {
  const m = product.priceMenudeo;
  const y = product.priceMayoreo;
  if (paidUnit === y) return "mayoreo";
  if (paidUnit === m) return "menudeo";
  return Math.abs(paidUnit - m) <= Math.abs(paidUnit - y) ? "menudeo" : "mayoreo";
}

export function isSameValueExchangeAtTier(
  originalUnitPrice: number,
  returnQty: number,
  replacement: Product,
  replacementQty: number,
  tier: PriceTier
): boolean {
  return (
    computeWarrantyExchangeBreakdown(
      originalUnitPrice,
      returnQty,
      replacement,
      replacementQty,
      tier
    ).diff === 0
  );
}

export function computeWarrantyExchangeBreakdown(
  originalUnitPrice: number,
  returnQty: number,
  replacement: Product,
  replacementQty: number,
  tier: PriceTier
): WarrantyExchangeBreakdown {
  const credit = warrantyCredit(originalUnitPrice, returnQty);
  const newTotal = warrantyReplacementTotal(replacement, replacementQty, tier);
  const diff = Math.round(newTotal - credit);
  return {
    credit,
    newTotal,
    diff,
    extraDue: Math.max(0, diff),
    creditToCustomer: Math.max(0, -diff),
  };
}
