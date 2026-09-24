import type { Product } from "@/types";

/** Categorías donde conviene registrar talla o longitud por separado. */
export const SIZE_BY_CATEGORY = new Set(["Anillos", "Pulseras", "Cadenas"]);

export function categoryUsesSize(category: string): boolean {
  return SIZE_BY_CATEGORY.has(category);
}

export function sizeFieldLabel(category: string): string {
  switch (category) {
    case "Anillos":
      return "Talla (número)";
    case "Pulseras":
      return "Longitud pulsera";
    case "Cadenas":
      return "Longitud cadena";
    default:
      return "Talla / medida";
  }
}

export function sizeFieldPlaceholder(category: string): string {
  switch (category) {
    case "Anillos":
      return "Ej. 7, 8.5, 12";
    case "Pulseras":
      return "Ej. 18 cm, 19 cm";
    case "Cadenas":
      return "Ej. 40 cm, 45 cm, 50 cm";
    default:
      return "Opcional";
  }
}

export function formatProductSize(size?: string): string | undefined {
  const s = size?.trim();
  return s || undefined;
}

/** Nombre para POS, etiquetas y tickets cuando hay talla. */
export function productDisplayName(
  product: Pick<Product, "name" | "size">
): string {
  const size = formatProductSize(product.size);
  if (!size) return product.name;
  return `${product.name} · ${size}`;
}
