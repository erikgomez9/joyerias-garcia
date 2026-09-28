import { materialLabel } from "@/lib/materials";
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

export function groupCatalogByMaterial(
  items: PublicCatalogItem[]
): [string, PublicCatalogItem[]][] {
  const map = new Map<string, { sample: PublicCatalogItem; items: PublicCatalogItem[] }>();

  for (const item of items) {
    const label = materialSectionLabel(item);
    let entry = map.get(label);
    if (!entry) {
      entry = { sample: item, items: [] };
      map.set(label, entry);
    }
    entry.items.push(item);
  }

  return [...map.entries()]
    .sort(
      (a, b) =>
        sectionSortRank(a[0], a[1].sample) - sectionSortRank(b[0], b[1].sample) ||
        a[0].localeCompare(b[0])
    )
    .map(([label, { items: list }]) => [
      label,
      [...list].sort((a, b) =>
        a.category.localeCompare(b.category) || a.name.localeCompare(b.name)
      ),
    ]);
}

export function materialAnchorId(label: string): string {
  return `vitrina-material-${label
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")}`;
}
