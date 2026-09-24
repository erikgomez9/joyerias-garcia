import { materialLabel } from "@/lib/materials";
import type { Product, SaleRecord } from "@/types";

type SaleItem = SaleRecord["items"][number];

export function findProductForSaleLine(
  item: SaleItem,
  products: Product[]
): Product | undefined {
  if (item.productId) {
    const byId = products.find((p) => p.id === item.productId);
    if (byId) return byId;
  }
  const sku = item.sku?.trim();
  if (sku) return products.find((p) => p.sku === sku);
  return undefined;
}

export function resolveSaleLineMaterial(
  item: SaleItem,
  product?: Product
): string | undefined {
  const metal = item.metal ?? product?.metal;
  const metalOther = item.metalOther ?? product?.metalOther;
  if (!metal) return undefined;
  const label = materialLabel(metal, metalOther);
  return label === "—" ? undefined : label;
}

export function resolveSaleLineUnitCost(
  item: SaleItem,
  product?: Product
): number | undefined {
  if (item.unitCost != null && item.unitCost >= 0) return item.unitCost;
  if (product?.priceMayoreo != null && product.priceMayoreo >= 0) {
    return product.priceMayoreo;
  }
  return undefined;
}
