import type { OrderKind, OrderStatus } from "@/types";

/** Todos los pedidos nuevos son encargo; tipos viejos se muestran igual. */
export const ORDER_KIND_LABEL = "Encargo";

export const ORDER_KIND_LABELS: Record<OrderKind, string> = {
  encargo: ORDER_KIND_LABEL,
  apartado: ORDER_KIND_LABEL,
  reparacion: ORDER_KIND_LABEL,
};

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pendiente: "Pendiente",
  listo: "Listo",
  entregado: "Entregado",
  cancelado: "Cancelado",
};

export const ACTIVE_ORDER_STATUSES: OrderStatus[] = ["pendiente", "listo"];

/** Filtros de lista: mismos nombres que las etiquetas de estado en cada pedido. */
export type OrderStatusFilter = "activos" | "todos" | OrderStatus;

export const ORDER_STATUS_FILTERS: OrderStatusFilter[] = [
  "activos",
  "pendiente",
  "listo",
  "entregado",
  "cancelado",
  "todos",
];

export function orderStatusFilterLabel(filter: OrderStatusFilter): string {
  if (filter === "activos") return "Activos";
  if (filter === "todos") return "Todos";
  return ORDER_STATUS_LABELS[filter];
}

export function matchesOrderStatusFilter(
  status: OrderStatus,
  filter: OrderStatusFilter
): boolean {
  if (filter === "todos") return true;
  if (filter === "activos") return ACTIVE_ORDER_STATUSES.includes(status);
  return status === filter;
}

export function orderBalance(o: {
  totalAmount: number;
  depositPaid: number;
}): number {
  const cents = Math.round((o.totalAmount - o.depositPaid) * 100);
  return Math.max(0, cents / 100);
}

export function orderIsFullyPaid(o: {
  totalAmount: number;
  depositPaid: number;
}): boolean {
  return orderBalance(o) <= 0;
}

export function formatDueDate(iso?: string): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "medium" }).format(
    new Date(iso)
  );
}

/** Texto principal del pedido en listas y detalle. */
export function orderSummary(o: {
  title: string;
  productName?: string;
  description?: string;
  items?: { name: string }[];
}): string {
  if (o.items?.length) {
    const first = o.items[0]!.name;
    if (o.items.length === 1) return first;
    return `${first} (+${o.items.length - 1})`;
  }
  if (o.productName) return o.productName;
  if (o.description?.trim()) return o.description.trim();
  return o.title;
}

export function orderLinesTotal(
  items: { qty: number; unitPrice: number }[]
): number {
  return items.reduce((s, l) => s + l.qty * l.unitPrice, 0);
}
