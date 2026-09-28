import { materialLabel } from "@/lib/materials";
import { PRODUCT_CATEGORIES } from "@/lib/inventoryCodes";
import type { Metal, PublicCatalogItem } from "@/types";

const METAL_SORT: Metal[] = [
  "oro",
  "plata",
  "oro_laminado",
  "rodio",
  "acero",
  "otro",
];

export function materialSectionLabel(item: PublicCatalogItem): string {
  if (!item.metal) return "Sin material especificado";
  return materialLabel(item.metal, item.metalOther);
}

export function itemMaterialSlug(item: PublicCatalogItem): string {
  if (!item.metal) return "sin-material";
  if (item.metal === "otro") {
    const raw = item.metalOther?.trim() || "otro";
    return slugify(raw);
  }
  return item.metal;
}

export function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

function sectionSortRank(label: string, sample?: PublicCatalogItem): number {
  const metal = sample?.metal;
  if (metal && METAL_SORT.includes(metal)) {
    const base = METAL_SORT.indexOf(metal) * 10;
    if (metal === "otro" && sample.metalOther?.trim()) return base + 1;
    return base;
  }
  if (label === "Sin material especificado") return 999;
  return 500;
}

function categorySortIndex(category: string): number {
  const i = PRODUCT_CATEGORIES.indexOf(category as (typeof PRODUCT_CATEGORIES)[number]);
  return i >= 0 ? i : PRODUCT_CATEGORIES.length + 1;
}

function groupItemsByCategory(
  items: PublicCatalogItem[]
): { category: string; items: PublicCatalogItem[] }[] {
  const map = new Map<string, PublicCatalogItem[]>();
  for (const item of items) {
    const cat = item.category?.trim() || "Otros";
    const list = map.get(cat) ?? [];
    list.push(item);
    map.set(cat, list);
  }
  return [...map.entries()]
    .sort(
      (a, b) =>
        categorySortIndex(a[0]) - categorySortIndex(b[0]) ||
        a[0].localeCompare(b[0])
    )
    .map(([category, list]) => ({
      category,
      items: [...list].sort((a, b) => a.name.localeCompare(b.name)),
    }));
}

export type MaterialCatalogBlock = {
  material: string;
  materialSlug: string;
  sample: PublicCatalogItem;
  categories: { category: string; items: PublicCatalogItem[] }[];
  itemCount: number;
};

export function buildMaterialCatalogs(
  items: PublicCatalogItem[],
  onlyMaterialSlug?: string
): MaterialCatalogBlock[] {
  const filtered = onlyMaterialSlug
    ? items.filter((i) => itemMaterialSlug(i) === onlyMaterialSlug)
    : items;

  const map = new Map<
    string,
    { label: string; sample: PublicCatalogItem; items: PublicCatalogItem[] }
  >();

  for (const item of filtered) {
    const label = materialSectionLabel(item);
    const key = itemMaterialSlug(item);
    let entry = map.get(key);
    if (!entry) {
      entry = { label, sample: item, items: [] };
      map.set(key, entry);
    }
    entry.items.push(item);
  }

  return [...map.entries()]
    .sort(
      (a, b) =>
        sectionSortRank(a[1].label, a[1].sample) -
          sectionSortRank(b[1].label, b[1].sample) ||
        a[1].label.localeCompare(b[1].label)
    )
    .map(([materialSlug, { label, sample, items: list }]) => {
      const categories = groupItemsByCategory(list);
      return {
        material: label,
        materialSlug,
        sample,
        categories,
        itemCount: list.length,
      };
    });
}

export function materialAnchorId(label: string): string {
  return `vitrina-material-${slugify(label)}`;
}

export function categoryAnchorId(materialLabel: string, category: string): string {
  return `${materialAnchorId(materialLabel)}-cat-${slugify(category)}`;
}

/** @deprecated use buildMaterialCatalogs */
export function groupCatalogByMaterial(
  items: PublicCatalogItem[]
): [string, PublicCatalogItem[]][] {
  return buildMaterialCatalogs(items).map((b) => [
    b.material,
    b.categories.flatMap((c) => c.items),
  ]);
}
