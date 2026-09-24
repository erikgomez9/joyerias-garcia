import { productPrice, type PriceTier } from "@/lib/format";
import { findProductForSaleLine } from "@/lib/saleLineDetails";
import type { CartLine, Product, SaleRecord } from "@/types";

/** Leyenda impresa en tickets de venta al cliente. */
export const SALE_NO_RETURNS_POLICY =
  "No se aceptan devoluciones ni cambios.";

/** A partir de este total (menudeo) se cobra todo el ticket a mayoreo. */
export const MAYOREO_MIN_TOTAL_MXN = 500;

export function cartSubtotalAtTier(
  lines: CartLine[],
  tier: PriceTier
): number {
  return lines.reduce(
    (s, l) => s + productPrice(l.product, tier) * l.qty,
    0
  );
}

/** Regla tienda: si el ticket en menudeo llega a $500+, precio mayoreo en todas las líneas. */
export function priceTierForCart(lines: CartLine[]): PriceTier {
  const menudeo = cartSubtotalAtTier(lines, "menudeo");
  return menudeo >= MAYOREO_MIN_TOTAL_MXN ? "mayoreo" : "menudeo";
}

export function cartTotal(lines: CartLine[]): number {
  const tier = priceTierForCart(lines);
  return cartSubtotalAtTier(lines, tier);
}

export function priceTierLabel(tier: PriceTier): string {
  return tier === "mayoreo" ? "Mayoreo" : "Menudeo";
}

export function priceTierHint(lines: CartLine[], tier: PriceTier): string {
  const menudeo = cartSubtotalAtTier(lines, "menudeo");
  if (tier === "mayoreo") {
    return `Precio mayoreo (menudeo ≥ ${formatShort(MAYOREO_MIN_TOTAL_MXN)}).`;
  }
  const falta = MAYOREO_MIN_TOTAL_MXN - menudeo;
  if (lines.length === 0) return "Precio menudeo.";
  return `Precio menudeo. Faltan ${formatShort(falta)} para mayoreo.`;
}

export function resolveSalePriceTier(
  sale: SaleRecord,
  products: Product[]
): PriceTier | undefined {
  if (sale.priceTier) return sale.priceTier;
  if (sale.items.length === 0) return undefined;

  let menudeo = 0;
  for (const item of sale.items) {
    const p = findProductForSaleLine(item, products);
    if (p) menudeo += p.priceMenudeo * item.qty;
    else menudeo += item.unitPrice * item.qty;
  }
  return menudeo >= MAYOREO_MIN_TOTAL_MXN ? "mayoreo" : "menudeo";
}

function formatShort(n: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(Math.max(0, n));
}
