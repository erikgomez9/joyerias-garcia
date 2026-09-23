import { formatDate } from "@/lib/format";
import type { DamageRecord } from "@/types";

function csvEscape(value: string | number | undefined): string {
  const s = value == null ? "" : String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function downloadDamagesCsv(rows: DamageRecord[], filename?: string) {
  const header = [
    "Fecha",
    "SKU",
    "Nombre",
    "Cantidad",
    "Motivo",
    "Notas",
    "Stock después",
    "Venta id",
    "Garantía id",
  ];
  const lines = rows.map((d) =>
    [
      formatDate(d.at),
      d.sku,
      d.name,
      d.qty,
      d.reason,
      d.notes ?? "",
      d.stockAfter ?? "",
      d.saleId ?? "",
      d.warrantyCaseId ?? "",
    ]
      .map(csvEscape)
      .join(",")
  );
  const blob = new Blob([`\uFEFF${header.join(",")}\n${lines.join("\n")}`], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download =
    filename ?? `danos-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
