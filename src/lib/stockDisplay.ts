import type { ProductStatus } from "@/types";

export type StockVisualKind = "out" | "low" | "ok";

export function stockVisualKind(item: {
  stock: number;
  status?: string;
}): StockVisualKind {
  if (
    item.stock <= 0 ||
    item.status === "vendido" ||
    item.status === "danado"
  ) {
    return "out";
  }
  if (item.stock <= 3) return "low";
  return "ok";
}

export function isOutOfStock(item: {
  stock: number;
  status?: string;
}): boolean {
  return stockVisualKind(item) === "out";
}

export const PRODUCT_STATUS_LABELS: Record<ProductStatus, string> = {
  disponible: "Disponible",
  reservado: "En pedido",
  vendido: "Vendido",
  taller: "En taller",
  danado: "Dañada",
};

export type ProductStatusFilter = "todos" | ProductStatus;

export const PRODUCT_STATUS_FILTERS: ProductStatusFilter[] = [
  "todos",
  "disponible",
  "reservado",
  "vendido",
  "taller",
  "danado",
];

export function productStatusFilterLabel(filter: ProductStatusFilter): string {
  if (filter === "todos") return "Todos";
  if (filter === "vendido") return "Vendido / agotado";
  return PRODUCT_STATUS_LABELS[filter];
}

/** Filtros de inventario: agotado (stock 0) cuenta como vendido, salvo en pedido o taller. */
export function matchesProductStatusFilter(
  product: { stock: number; status: ProductStatus },
  filter: ProductStatusFilter
): boolean {
  if (filter === "todos") return true;
  if (filter === "disponible") {
    return product.status === "disponible" && product.stock > 0;
  }
  if (filter === "reservado") return product.status === "reservado";
  if (filter === "taller") return product.status === "taller";
  if (filter === "danado") return product.status === "danado";
  if (filter === "vendido") {
    if (
      product.status === "reservado" ||
      product.status === "taller" ||
      product.status === "danado"
    ) {
      return false;
    }
    return product.status === "vendido" || product.stock <= 0;
  }
  return product.status === filter;
}

export function stockBadgeText(item: {
  stock: number;
  status?: string;
}): string {
  const kind = stockVisualKind(item);
  if (kind === "out") return "Agotado";
  if (kind === "low") return `Quedan ${item.stock}`;
  return String(item.stock);
}
