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

/** Ej. AR001 — dos letras de categoría + al menos 3 dígitos */
export const JEWELRY_CODE_PATTERN = /^[A-Z]{2}\d{3,}$/i;

export function categoryCode(category: string): string {
  return CATEGORY_CODE[category] ?? "OT";
}

function maxSequenceForPrefix(prefix: string, existing: Product[]): number {
  const code = prefix.toUpperCase();
  let max = 0;
  const reNew = new RegExp(`^${code}(\\d+)$`, "i");
  const reLegacySku = new RegExp(`^JG-${code}-(\\d+)$`, "i");

  for (const p of existing) {
    for (const raw of [p.sku, p.barcode]) {
      if (!raw?.trim()) continue;
      const u = raw.trim().toUpperCase();
      let m = u.match(reNew);
      if (m) {
        const n = Number.parseInt(m[1], 10);
        if (!Number.isNaN(n) && n > max) max = n;
        continue;
      }
      m = u.match(reLegacySku);
      if (m) {
        const n = Number.parseInt(m[1], 10);
        if (!Number.isNaN(n) && n > max) max = n;
      }
    }
  }
  return max;
}

/**
 * Código de joya: prefijo de categoría + secuencia (3 dígitos).
 * Ej. Aretes → AR001, Cadenas → CD042. Sirve como SKU y código de barras.
 */
export function generateJewelryCode(
  category: string,
  existing: Product[]
): string {
  const prefix = categoryCode(category);
  const next = maxSequenceForPrefix(prefix, existing) + 1;
  return `${prefix}${String(next).padStart(3, "0")}`;
}

/** @deprecated alias — usa generateJewelryCode */
export function generateSku(
  category: string,
  existing: Product[]
): string {
  return generateJewelryCode(category, existing);
}

/** Mismo código que el SKU (legible en etiqueta y escáner). */
export function generateBarcode(
  category: string,
  existing: Product[]
): string {
  return generateJewelryCode(category, existing);
}

export function normalizeJewelryCode(raw: string): string {
  return raw.trim().toUpperCase();
}

export function isValidJewelryCode(raw: string): boolean {
  return JEWELRY_CODE_PATTERN.test(normalizeJewelryCode(raw));
}

export function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
