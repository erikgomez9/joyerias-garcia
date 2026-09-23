import { productPrice, type PriceTier } from "@/lib/format";
import {
  MAYOREO_MIN_TOTAL_MXN,
  priceTierLabel,
} from "@/lib/salePricing";
import type { OrderLine, Product } from "@/types";

type PricedLine = Pick<OrderLine, "productId" | "qty" | "unitPrice">;

/** Subtotal como si todo fuera menudeo (piezas del inventario + conceptos). */
export function orderMenudeoSubtotal(
  lines: PricedLine[],
  products: Product[]
): number {
  return lines.reduce((s, line) => {
    if (line.productId) {
      const p = products.find((x) => x.id === line.productId);
      if (p) return s + p.priceMenudeo * line.qty;
    }
    return s + line.unitPrice * line.qty;
  }, 0);
}

/** Misma regla que POS: menudeo ≥ $500 → mayoreo en piezas de inventario. */
export function priceTierForOrderLines(
  lines: PricedLine[],
  products: Product[]
): PriceTier {
  const menudeo = orderMenudeoSubtotal(lines, products);
  return menudeo >= MAYOREO_MIN_TOTAL_MXN ? "mayoreo" : "menudeo";
}

export function applyOrderPricing<T extends PricedLine>(
  lines: T[],
  products: Product[]
): T[] {
  const tier = priceTierForOrderLines(lines, products);
  return lines.map((line) => {
    if (!line.productId) return line;
    const p = products.find((x) => x.id === line.productId);
    if (!p) return line;
    return { ...line, unitPrice: productPrice(p, tier) };
  });
}

export function orderPriceTierHint(
  lines: PricedLine[],
  products: Product[]
): string {
  const tier = priceTierForOrderLines(lines, products);
  const menudeo = orderMenudeoSubtotal(lines, products);
  if (tier === "mayoreo") {
    return `Precio mayoreo en piezas (menudeo ≥ ${formatShort(MAYOREO_MIN_TOTAL_MXN)}).`;
  }
  if (lines.length === 0) return "Precio menudeo en piezas del inventario.";
  const falta = MAYOREO_MIN_TOTAL_MXN - menudeo;
  return `Piezas a menudeo. Faltan ${formatShort(falta)} para mayoreo.`;
}

function formatShort(n: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(Math.max(0, n));
}

export { priceTierLabel };
