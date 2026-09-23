import { formatDate } from "@/lib/format";
import { formatPaymentMix } from "@/lib/paymentMix";
import {
  isOrderSale,
  saleOriginText,
  salePaymentLabel,
} from "@/lib/saleOrigin";
import { saleNetTotal, warrantySaleHeadline } from "@/lib/warrantyLabels";
import type { OrderRecord, SaleRecord } from "@/types";

function escapeCsv(value: string | number | undefined): string {
  const s = value === undefined || value === null ? "" : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function paymentDetail(s: SaleRecord, orders: OrderRecord[]): string {
  if (isOrderSale(s, orders)) return "";
  if (s.payment === "mixto" && s.paymentMix) {
    return formatPaymentMix(s.paymentMix);
  }
  return s.payment;
}

function itemsSummary(s: SaleRecord): string {
  return s.items.map((i) => `${i.name} x${i.qty}`).join("; ");
}

export function salesToCsv(
  sales: SaleRecord[],
  orders: OrderRecord[] = []
): string {
  const headers = [
    "Fecha",
    "Efecto caja",
    "Origen",
    "Forma de pago",
    "Detalle pago",
    "Vendedor",
    "Piezas",
  ];
  const rows = sales.map((s) => [
    formatDate(s.at),
    saleNetTotal(s),
    warrantySaleHeadline(s) ?? saleOriginText(s, orders),
    salePaymentLabel(s, orders),
    paymentDetail(s, orders),
    s.seller,
    itemsSummary(s),
  ]);
  return [headers, ...rows]
    .map((row) => row.map(escapeCsv).join(","))
    .join("\n");
}

export function downloadSalesCsv(
  sales: SaleRecord[],
  filename?: string,
  orders: OrderRecord[] = []
): void {
  const csv = salesToCsv(sales, orders);
  const blob = new Blob(["\uFEFF" + csv], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const date = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = filename ?? `ventas-joyerias-garcia-${date}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
