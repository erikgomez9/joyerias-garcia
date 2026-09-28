import { COMMISSION_RATE, quincenaBoundsFromKey, quincenaLabel } from "@/lib/quincena";
import type { CommissionReport } from "@/types/commissions";
import type { SaleRecord } from "@/types";

function commissionBase(s: SaleRecord): number {
  if (s.kind === "warranty") return 0;
  if (s.total <= 0) return 0;
  return s.total;
}

function sellerLabel(raw: string | undefined): string {
  const name = raw?.trim();
  if (!name || name === "Mostrador") return "Sin vendedora";
  return name;
}

export function buildCommissionReportLocal(
  sales: SaleRecord[],
  quincenaKey: string,
  rate = COMMISSION_RATE
): CommissionReport {
  const bounds = quincenaBoundsFromKey(quincenaKey);
  if (!bounds) {
    throw new Error("Quincena inválida.");
  }
  const fromMs = bounds.from.getTime();
  const toMs = bounds.to.getTime();

  const bySeller = new Map<
    string,
    CommissionReport["rows"][number]
  >();

  for (const s of sales) {
    const at = new Date(s.at).getTime();
    if (at < fromMs || at >= toMs) continue;
    const base = commissionBase(s);
    if (base <= 0) continue;
    const seller = sellerLabel(s.seller);
    let row = bySeller.get(seller);
    if (!row) {
      row = {
        seller,
        salesCount: 0,
        salesTotal: 0,
        commission: 0,
        sales: [],
      };
      bySeller.set(seller, row);
    }
    row.salesCount += 1;
    row.salesTotal += base;
    row.commission += base * rate;
    row.sales.push({
      id: s.id,
      at: s.at,
      total: base,
      commission: base * rate,
      payment: s.payment,
    });
  }

  const rows = [...bySeller.values()]
    .filter((r) => r.seller !== "Sin vendedora" || r.salesCount > 0)
    .sort(
      (a, b) =>
        b.commission - a.commission ||
        b.salesTotal - a.salesTotal ||
        a.seller.localeCompare(b.seller, "es")
    );

  const totals = rows.reduce(
    (acc, r) => {
      acc.salesCount += r.salesCount;
      acc.salesTotal += r.salesTotal;
      acc.commission += r.commission;
      return acc;
    },
    { salesCount: 0, salesTotal: 0, commission: 0 }
  );

  return {
    quincenaKey,
    quincenaLabel: quincenaLabel(quincenaKey),
    rate,
    from: bounds.from.toISOString(),
    to: bounds.to.toISOString(),
    rows,
    totals,
  };
}
