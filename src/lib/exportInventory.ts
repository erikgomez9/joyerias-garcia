import { metalLabel } from "@/lib/format";
import type { Product } from "@/types";

function escapeCsv(value: string | number | undefined): string {
  const s = value === undefined || value === null ? "" : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function productsToCsv(products: Product[]): string {
  const headers = [
    "SKU",
    "Codigo barras",
    "Nombre",
    "Categoria",
    "Material",
    "Piedras",
    "Peso g",
    "Precio mayoreo",
    "Precio menudeo",
    "Stock",
    "Estado",
    "Notas",
  ];
  const rows = products.map((p) => [
    p.sku,
    p.barcode,
    p.name,
    p.category,
    metalLabel(p.metal, p.metalOther),
    p.stones ?? "",
    p.weightGrams ?? "",
    p.priceMayoreo,
    p.priceMenudeo,
    p.stock,
    p.status,
    p.notes ?? "",
  ]);
  return [headers, ...rows]
    .map((row) => row.map(escapeCsv).join(","))
    .join("\n");
}

export function downloadInventoryCsv(products: Product[], filename?: string): void {
  const csv = productsToCsv(products);
  const blob = new Blob(["\uFEFF" + csv], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const date = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = filename ?? `inventario-joyerias-garcia-${date}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
