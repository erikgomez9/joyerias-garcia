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

/** Vitrina: nombre del modelo sin mezclar la talla en el título. */
export function catalogItemName(
  product: Pick<Product, "name">
): string {
  return product.name.trim();
}

/** Vitrina: etiqueta clara de talla o medida para clientes. */
export function catalogSizeDisplay(
  category: string,
  size?: string
): { label: string; value: string } | null {
  const value = formatProductSize(size);
  if (!value) return null;
  switch (category) {
    case "Anillos":
      return { label: "Talla", value };
    case "Pulseras":
      return { label: "Longitud", value };
    case "Cadenas":
      return { label: "Longitud", value };
    default:
      return categoryUsesSize(category)
        ? { label: "Medida", value }
        : { label: "Medida", value };
  }
}

/** Texto accesible (zoom, aria) con talla explícita. */
export function catalogAccessibleTitle(
  product: Pick<Product, "name" | "size" | "category">
): string {
  const name = catalogItemName(product);
  const size = catalogSizeDisplay(product.category, product.size);
  if (!size) return name;
  return `${name}, ${size.label} ${size.value}`;
}
