import type { SaleRecord } from "@/types";

export type SalesPeriod = "today" | "week" | "month" | "all";

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function startOfWeekMonday(d: Date): Date {
  const x = startOfDay(d);
  const day = x.getDay();
  const diff = day === 0 ? 6 : day - 1;
  x.setDate(x.getDate() - diff);
  return x;
}

function startOfMonth(d: Date): Date {
  const x = startOfDay(d);
  x.setDate(1);
  return x;
}

export function periodStart(period: SalesPeriod, now = new Date()): number | null {
  if (period === "all") return null;
  if (period === "today") return startOfDay(now).getTime();
  if (period === "week") return startOfWeekMonday(now).getTime();
  return startOfMonth(now).getTime();
}

export function filterSalesByPeriod(
  sales: SaleRecord[],
  period: SalesPeriod,
  now = new Date()
): SaleRecord[] {
  const from = periodStart(period, now);
  if (from == null) return sales;
  return sales.filter((s) => new Date(s.at).getTime() >= from);
}

export const SALES_PERIOD_LABELS: Record<SalesPeriod, string> = {
  today: "Hoy",
  week: "Esta semana",
  month: "Este mes",
  all: "Todo el historial",
};
