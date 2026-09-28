import { SALES_PERIOD_LABELS, type SalesPeriod } from "@/lib/saleDateFilter";
import { formatDate } from "@/lib/format";
import type { DayCloseRecord } from "@/types/dayClose";
import type { LiveSalesReport } from "@/types/reports";
import { formatDayKeyLabel } from "@/lib/saleDateFilter";

function escapeCsv(value: string | number | undefined): string {
  const s = value === undefined || value === null ? "" : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function rowsToCsv(rows: (string | number)[][]): string {
  return rows.map((row) => row.map(escapeCsv).join(",")).join("\n");
}

export function liveReportToCsv(
  report: LiveSalesReport,
  period: SalesPeriod
): string {
  const sections: string[] = [];
  const periodLabel = SALES_PERIOD_LABELS[period];

  sections.push(
    rowsToCsv([
      ["Reporte de ventas — Joyerías García"],
      ["Periodo", periodLabel],
      ["Generado", formatDate(report.generatedAt)],
      [],
      ["Resumen"],
      ["Tickets", report.summary.tickets],
      ["Total vendido", report.summary.total],
      ["Ticket promedio", report.summary.avgTicket.toFixed(2)],
      ["Piezas vendidas", report.summary.pieces],
    ])
  );

  if (report.byPayment.length > 0) {
    sections.push(
      rowsToCsv([
        [],
        ["Formas de pago", "Monto"],
        ...report.byPayment.map((p) => [p.label, p.amount]),
      ])
    );
  }

  if (report.byPriceTier?.length) {
    sections.push(
      rowsToCsv([
        [],
        ["Mayoreo / menudeo", "Monto"],
        ...report.byPriceTier.map((p) => [p.label, p.amount]),
      ])
    );
  }

  if (report.starProducts.length > 0) {
    sections.push(
      rowsToCsv([
        [],
        ["Productos estrella", "SKU", "Piezas", "Importe"],
        ...report.starProducts.map((p) => [
          p.name,
          p.sku,
          p.qty,
          p.revenue,
        ]),
      ])
    );
  }

  if (report.outOfStock.length > 0) {
    sections.push(
      rowsToCsv([
        [],
        ["Sin stock / agotados", "SKU", "Categoría", "Stock", "Estado"],
        ...report.outOfStock.map((p) => [
          p.name,
          p.sku,
          p.category,
          p.stock,
          p.status,
        ]),
      ])
    );
  }

  if (report.lowStock.length > 0) {
    sections.push(
      rowsToCsv([
        [],
        ["Stock bajo (≤3)", "SKU", "Categoría", "Stock", "Estado"],
        ...report.lowStock.map((p) => [
          p.name,
          p.sku,
          p.category,
          p.stock,
          p.status,
        ]),
      ])
    );
  }

  return sections.join("\n");
}

export function dayCloseToCsv(record: DayCloseRecord): string {
  return rowsToCsv([
    ["Cierre de día — Joyerías García"],
    ["Día", formatDayKeyLabel(record.dayKey)],
    ["Cerrado", formatDate(record.closedAt)],
    [],
    ["Tickets", record.summary.tickets],
    ["Total vendido", record.summary.total],
    ["Ticket promedio", record.summary.avgTicket.toFixed(2)],
    ["Piezas vendidas", record.summary.pieces],
    [],
    ["Formas de pago", "Monto"],
    ...record.byPayment.map((p) => [p.label, p.amount]),
    ...(record.byPriceTier.length
      ? [
          [],
          ["Mayoreo / menudeo", "Monto"],
          ...record.byPriceTier.map((p) => [p.label, p.amount]),
        ]
      : []),
  ]);
}

export function downloadDayCloseCsv(record: DayCloseRecord): void {
  const csv = dayCloseToCsv(record);
  const blob = new Blob(["\uFEFF" + csv], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `cierre-dia-${record.dayKey}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadLiveReportCsv(
  report: LiveSalesReport,
  period: SalesPeriod
): void {
  const csv = liveReportToCsv(report, period);
  const blob = new Blob(["\uFEFF" + csv], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const date = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `reporte-ventas-${period}-${date}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
