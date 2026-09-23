import type { OrderRecord, SaleRecord } from "@/types";

export function resolveOrderCode(
  sale: SaleRecord,
  orders: OrderRecord[]
): string | undefined {
  if (sale.orderCode?.trim()) return sale.orderCode.trim();
  if (!sale.orderId) return undefined;
  return orders.find((o) => o.id === sale.orderId)?.orderCode;
}

export function isSaleFromOrder(
  sale: SaleRecord,
  orders: OrderRecord[]
): boolean {
  return Boolean(sale.orderId || resolveOrderCode(sale, orders));
}

export function saleOriginText(
  sale: SaleRecord,
  orders: OrderRecord[]
): string {
  const code = resolveOrderCode(sale, orders);
  if (code) return `Pedido ${code}`;
  return "Punto de venta";
}

/** Ventas al entregar pedido: el cobro real está en los abonos del pedido. */
export function isOrderSale(
  sale: SaleRecord,
  orders: OrderRecord[] = []
): boolean {
  return sale.payment === "pedido" || isSaleFromOrder(sale, orders);
}

export function salePaymentLabel(
  sale: SaleRecord,
  orders: OrderRecord[] = []
): string {
  if (isOrderSale(sale, orders)) return "Abonos en pedido";
  if (sale.payment === "mixto") return "Mixto";
  return sale.payment.charAt(0).toUpperCase() + sale.payment.slice(1);
}
