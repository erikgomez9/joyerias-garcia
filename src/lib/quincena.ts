export const COMMISSION_RATE = 0.01;

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function quincenaKeyForDate(d = new Date()): string {
  const x = startOfDay(d);
  const y = x.getFullYear();
  const mo = String(x.getMonth() + 1).padStart(2, "0");
  const half = x.getDate() <= 15 ? "1" : "2";
  return `${y}-${mo}-${half}`;
}

export function quincenaBoundsFromKey(key: string): { from: Date; to: Date } | null {
  const m = /^(\d{4})-(\d{2})-(1|2)$/.exec(key.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  if (m[3] === "1") {
    return {
      from: new Date(y, mo, 1, 0, 0, 0, 0),
      to: new Date(y, mo, 16, 0, 0, 0, 0),
    };
  }
  return {
    from: new Date(y, mo, 16, 0, 0, 0, 0),
    to: new Date(y, mo + 1, 1, 0, 0, 0, 0),
  };
}

export function previousQuincenaKey(key: string): string | null {
  const bounds = quincenaBoundsFromKey(key);
  if (!bounds) return null;
  const prevDay = new Date(bounds.from);
  prevDay.setDate(prevDay.getDate() - 1);
  return quincenaKeyForDate(prevDay);
}

export function quincenaLabel(key: string): string {
  const bounds = quincenaBoundsFromKey(key);
  if (!bounds) return key;
  const endDisplay = new Date(bounds.to);
  endDisplay.setDate(endDisplay.getDate() - 1);
  const fmt = (dt: Date) =>
    dt.toLocaleDateString("es-MX", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  return `${fmt(bounds.from)} – ${fmt(endDisplay)}`;
}

export type QuincenaFilter = "current" | "previous";

export function resolveQuincenaKey(filter: QuincenaFilter): string {
  const cur = quincenaKeyForDate(new Date());
  if (filter === "current") return cur;
  return previousQuincenaKey(cur) ?? cur;
}
