import { categoryUsesSize } from "@/lib/productSize";
import type { Product } from "@/types";

export type ProductSizeVariant = {
  productId: string;
  sku: string;
  size?: string;
  stock: number;
};

export type ProductSizeGroup = {
  key: string;
  name: string;
  category: string;
  variants: ProductSizeVariant[];
  totalStock: number;
};

function variantSortKey(size?: string): string {
  const s = size?.trim() ?? "";
  const num = Number.parseFloat(s.replace(/[^\d.]/g, ""));
  if (!Number.isNaN(num) && s.match(/\d/)) {
    return `n:${num.toString().padStart(8, "0")}:${s.toLowerCase()}`;
  }
  return `t:${s.toLowerCase()}`;
}

export function groupProductsByModel(products: Product[]): ProductSizeGroup[] {
  const map = new Map<string, ProductSizeGroup>();

  for (const p of products) {
    if (!categoryUsesSize(p.category)) continue;
    const name = p.name.trim();
    if (!name) continue;
    const key = `${p.category}::${name.toLowerCase()}`;
    let group = map.get(key);
    if (!group) {
      group = {
        key,
        name,
        category: p.category,
        variants: [],
        totalStock: 0,
      };
      map.set(key, group);
    }
    group.variants.push({
      productId: p.id,
      sku: p.sku,
      size: p.size?.trim() || undefined,
      stock: p.stock,
    });
    group.totalStock += p.stock;
  }

  return [...map.values()]
    .map((g) => ({
      ...g,
      variants: [...g.variants].sort((a, b) =>
        variantSortKey(a.size).localeCompare(variantSortKey(b.size))
      ),
    }))
    .sort((a, b) =>
      a.category.localeCompare(b.category) || a.name.localeCompare(b.name)
    );
}

export function formatSizeGroupLine(group: ProductSizeGroup): string {
  return group.variants
    .map((v) => {
      const label = v.size ?? "sin talla";
      return `${label}→${v.stock} pza${v.stock === 1 ? "" : "s"}`;
    })
    .join(" · ");
}

export function filterSizeGroups(
  groups: ProductSizeGroup[],
  term: string
): ProductSizeGroup[] {
  const t = term.trim().toLowerCase();
  if (!t) return groups;
  return groups.filter(
    (g) =>
      g.name.toLowerCase().includes(t) ||
      g.category.toLowerCase().includes(t) ||
      g.variants.some(
        (v) =>
          v.sku.toLowerCase().includes(t) ||
          (v.size?.toLowerCase().includes(t) ?? false)
      )
  );
}
