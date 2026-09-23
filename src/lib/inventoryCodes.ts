import type { Product, ProductCategory } from "@/types";

const CATEGORY_CODE: Record<string, string> = {
  Anillos: "AN",
  Cadenas: "CD",
  Aretes: "AR",
  Pulseras: "PL",
  Dijes: "DI",
  Relojes: "RE",
  Otros: "OT",
};

export const PRODUCT_CATEGORIES: ProductCategory[] = [
  "Anillos",
  "Cadenas",
  "Aretes",
  "Pulseras",
  "Dijes",
  "Relojes",
  "Otros",
];

export function categoryCode(category: string): string {
  return CATEGORY_CODE[category] ?? "OT";
}

/** SKU: JG-AN-0001 (prefijo + categoría + secuencia) */
export function generateSku(
  category: string,
  existing: Product[]
): string {
  const code = categoryCode(category);
  const prefix = `JG-${code}-`;
  let max = 0;
  for (const p of existing) {
    if (!p.sku.startsWith(prefix)) continue;
    const n = Number.parseInt(p.sku.slice(prefix.length), 10);
    if (!Number.isNaN(n) && n > max) max = n;
  }
  return `${prefix}${String(max + 1).padStart(4, "0")}`;
}

/**
 * Código de barras numérico interno (13 dígitos estilo EAN).
 * Prefijo 780 = joyería interna; el resto es secuencia única.
 */
export function generateBarcode(existing: Product[]): string {
  let max = 0;
  for (const p of existing) {
    if (!/^\d{13}$/.test(p.barcode)) continue;
    if (!p.barcode.startsWith("780")) continue;
    const n = Number.parseInt(p.barcode.slice(3, 12), 10);
    if (!Number.isNaN(n) && n > max) max = n;
  }
  const body = `780${String(max + 1).padStart(9, "0")}`;
  return body + ean13CheckDigit(body);
}

function ean13CheckDigit(twelve: string): string {
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const d = Number(twelve[i]);
    sum += i % 2 === 0 ? d : d * 3;
  }
  return String((10 - (sum % 10)) % 10);
}

export function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
