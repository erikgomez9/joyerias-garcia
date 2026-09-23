import type { InventoryMode, Product, ProductInput } from "@/types";

export const INVENTORY_MODE_OPTIONS: {
  value: InventoryMode;
  title: string;
  description: string;
}[] = [
  {
    value: "catalog",
    title: "Modelo repetido",
    description:
      "Piezas idénticas (mismo diseño, material y precio). Un SKU, stock mayor a 1.",
  },
  {
    value: "unique",
    title: "Pieza única",
    description:
      "Anillo especial, piedra distinta o precio propio. Un SKU, stock siempre 1.",
  },
];

export function inventoryModeLabel(mode: InventoryMode): string {
  return mode === "unique" ? "Única" : "Modelo";
}

/** Documentos antiguos sin campo: stock > 1 → modelo; si no, única. */
export function resolveInventoryMode(
  product: Pick<Product, "inventoryMode" | "stock">
): InventoryMode {
  if (product.inventoryMode) return product.inventoryMode;
  return product.stock > 1 ? "catalog" : "unique";
}

export function applyInventoryModeRules(input: ProductInput): ProductInput {
  return {
    ...input,
    inventoryMode: "catalog",
    stock: Math.max(1, Math.floor(input.stock)),
  };
}

export function validateInventoryInput(input: ProductInput): string | null {
  const mode = input.inventoryMode ?? "catalog";
  if (mode === "unique" && input.stock !== 1) {
    return "Pieza única: el stock debe ser 1. Para más iguales, usa «Modelo repetido».";
  }
  if (mode === "catalog" && input.stock < 1) {
    return "Indica cuántas piezas iguales hay (stock mínimo 1).";
  }
  return null;
}
