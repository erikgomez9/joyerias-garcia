import { formatDate, formatMoney } from "@/lib/format";
import { resolveOrderCode, isSaleFromOrder } from "@/lib/saleOrigin";
import type { OrderRecord, SaleRecord, WarrantyType } from "@/types";

export const WARRANTY_TYPE_LABELS: Record<WarrantyType, string> = {
  same_value: "Cambio mismo valor ($0)",
  price_difference: "Cambio con diferencia",
  refund: "Reembolso",
};

export function isWarrantyAdjustmentSale(s: SaleRecord): boolean {
  return s.kind === "warranty";
}

export function warrantySaleHeadline(s: SaleRecord): string | null {
  if (s.kind !== "warranty") return null;
  if (s.warrantyType === "refund") return "Reembolso garantía";
  if (s.warrantyType === "exchange_same") return "Cambio garantía (sin cobro)";
  if (s.warrantyType === "exchange_diff") return "Cambio garantía (diferencia)";
  return "Garantía";
}

/** Monto que afecta caja en listados (reembolso negativo). */
export function saleNetTotal(s: SaleRecord): number {
  if (s.kind === "warranty" && s.warrantyType === "refund") {
    return -s.total;
  }
  return s.total;
}

export function resolveOriginalSale(
  adjustment: SaleRecord,
  allSales: SaleRecord[]
): SaleRecord | undefined {
  const id = adjustment.originalSaleId;
  if (!id) return undefined;
  return allSales.find((s) => s.id === id);
}

/** Texto corto: fecha · total · POS o pedido. */
export function originalSaleCaption(
  original: SaleRecord,
  orders: OrderRecord[]
): string {
  const folio = isSaleFromOrder(original, orders)
    ? `Pedido ${resolveOrderCode(original, orders) ?? "—"}`
    : "Punto de venta";
  return `${formatDate(original.at)} · ${formatMoney(original.total)} · ${folio}`;
}
