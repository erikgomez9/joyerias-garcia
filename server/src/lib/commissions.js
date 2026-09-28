import { SaleModel } from "../models/Sale.js";

/** Comisión fija por venta en mostrador. */
export const COMMISSION_RATE = 0.01;

export function commissionBaseForSale(doc) {
  if (doc.kind === "warranty") return 0;
  const t = doc.total ?? 0;
  if (t <= 0) return 0;
  return t;
}

export function normalizeSellerLabel(raw) {
  const name = raw?.trim();
  if (!name || name === "Mostrador") return "Sin vendedora";
  return name;
}

export async function buildCommissionReport(from, to, rate = COMMISSION_RATE) {
  const saleDocs = await SaleModel.find({
    createdAt: { $gte: from, $lt: to },
  })
    .sort({ createdAt: -1 })
    .lean();

  const bySeller = new Map();

  for (const doc of saleDocs) {
    const base = commissionBaseForSale(doc);
    if (base <= 0) continue;
    const seller = normalizeSellerLabel(doc.seller);
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
      id: doc._id.toString(),
      at: doc.createdAt?.toISOString?.() ?? new Date().toISOString(),
      total: base,
      commission: base * rate,
      payment: doc.payment,
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
    rate,
    from: from.toISOString(),
    to: to.toISOString(),
    rows: rows.map(({ sales, ...rest }) => ({
      ...rest,
      sales: sales.slice(0, 200),
    })),
    totals,
  };
}
