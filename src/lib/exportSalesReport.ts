import { SALES_PERIOD_LABELS, type SalesPeriod } from "@/lib/saleDateFilter";
import { formatDate } from "@/lib/format";
import type { LiveSalesReport } from "@/types/reports";

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
