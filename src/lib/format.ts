export function formatMoney(n: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(n);
}

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

export { materialLabel as metalLabel } from "./materials";

export function statusLabel(s?: string): string {
  if (!s) return "—";
  return s;
}

export type PriceTier = "mayoreo" | "menudeo";

export function productPrice(
  p: { priceMayoreo: number; priceMenudeo: number },
  tier: PriceTier = "menudeo"
): number {
  return tier === "mayoreo" ? p.priceMayoreo : p.priceMenudeo;
}
