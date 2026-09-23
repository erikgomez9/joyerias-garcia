import type { Product } from "@/types";

export function posProductBlockReason(product: Product): string | null {
  if (product.stock <= 0) return `${product.name}: sin stock.`;
  if (product.status === "danado") {
    return `${product.name} está registrada como dañada.`;
  }
  if (product.status !== "disponible") {
    return `${product.name} está apartada o no disponible en mostrador.`;
  }
  return null;
}

export function isProductSellableAtPos(product: Product): boolean {
  return posProductBlockReason(product) === null;
}
