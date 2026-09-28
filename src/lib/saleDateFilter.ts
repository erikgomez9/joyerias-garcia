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

export function localDayKey(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function formatDayKeyLabel(dayKey: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dayKey.trim());
  if (!m) return dayKey;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (Number.isNaN(d.getTime())) return dayKey;
  return d.toLocaleDateString("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
