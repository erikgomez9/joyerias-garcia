import type { Product } from "@/types";

/** Escáner USB suele enviar el código + Enter; también sirve pegar SKU/barra. */
export function findProductByScan(
  products: Product[],
  raw: string
): Product | null {
  const code = raw.trim();
  if (!code) return null;

  const byBarcode = products.find((p) => p.barcode === code);
  if (byBarcode) return byBarcode;

  const upper = code.toUpperCase();
  const bySku = products.find((p) => p.sku.toUpperCase() === upper);
  if (bySku) return bySku;

  return null;
}
