import { formatDate, formatMoney } from "@/lib/format";
import type { CommissionReport } from "@/types/commissions";

function escapeCsv(value: string | number | undefined): string {
  const s = value === undefined || value === null ? "" : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function rowsToCsv(rows: (string | number)[][]): string {
  return rows.map((row) => row.map(escapeCsv).join(",")).join("\n");
}

export function commissionReportToCsv(report: CommissionReport): string {
  const pct = (report.rate * 100).toFixed(1);
  const sections: string[] = [
    rowsToCsv([
      ["Comisiones — Joyerías García"],
      ["Quincena", report.quincenaLabel],
      ["Comisión por venta", `${pct}% del total`],
      [],
      ["Vendedora", "Ventas", "Total vendido", "Comisión"],
      ...report.rows.map((r) => [
        r.seller,
        r.salesCount,
        r.salesTotal.toFixed(2),
        r.commission.toFixed(2),
      ]),
      [],
      [
        "TOTAL",
        report.totals.salesCount,
        report.totals.salesTotal.toFixed(2),
        report.totals.commission.toFixed(2),
      ],
    ]),
  ];

  for (const row of report.rows) {
    if (row.sales.length === 0) continue;
    sections.push(
      rowsToCsv([
        [],
        [`Detalle — ${row.seller}`],
        ["Fecha", "Total", "Comisión", "Pago"],
        ...row.sales.map((s) => [
          formatDate(s.at),
          s.total.toFixed(2),
          s.commission.toFixed(2),
          s.payment,
        ]),
      ])
    );
  }

  return sections.join("\n");
}

export function downloadCommissionCsv(report: CommissionReport): void {
  const csv = commissionReportToCsv(report);
  const blob = new Blob(["\uFEFF" + csv], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `comisiones-${report.quincenaKey}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function formatCommissionRate(rate: number): string {
  return `${(rate * 100).toFixed(1).replace(/\.0$/, "")}%`;
}

export function formatMoneyPlain(n: number): string {
  return formatMoney(n);
}
