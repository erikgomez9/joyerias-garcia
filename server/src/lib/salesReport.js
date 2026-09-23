import { ProductModel, docToProduct } from "../models/Product.js";
import { SaleModel } from "../models/Sale.js";

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function startOfWeekMonday(d) {
  const x = startOfDay(d);
  const day = x.getDay();
  const diff = day === 0 ? 6 : day - 1;
  x.setDate(x.getDate() - diff);
  return x;
}

function startOfMonth(d) {
  const x = startOfDay(d);
  x.setDate(1);
  return x;
}

export function periodToDate(period, now = new Date()) {
  if (period === "all") return null;
  if (period === "today") return startOfDay(now);
  if (period === "week") return startOfWeekMonday(now);
  if (period === "month") return startOfMonth(now);
  return startOfMonth(now);
}

const VALID_PERIODS = ["today", "week", "month", "all"];

export function normalizeReportPeriod(raw) {
  if (VALID_PERIODS.includes(raw)) return raw;
  return "month";
}

/** Ingreso neto en caja: reembolsos restan; cambios $0 no suman. */
function saleNetAmount(doc) {
  const t = doc.total ?? 0;
  if (doc.kind === "warranty" && doc.warrantyType === "refund") {
    return -t;
  }
  return t;
}

function paymentLabel(sale) {
  if (sale.payment === "pedido") return "Pedido";
  if (sale.payment === "mixto") return "Mixto";
  return sale.payment.charAt(0).toUpperCase() + sale.payment.slice(1);
}

function aggregateStarProducts(sales) {
  const map = new Map();
  for (const sale of sales) {
    if (sale.kind === "warranty") continue;
    for (const item of sale.items ?? []) {
      const key = (item.sku?.trim() || item.name?.trim() || "—").toUpperCase();
      const prev = map.get(key) ?? {
        sku: item.sku?.trim() || "—",
        name: item.name,
        qty: 0,
        revenue: 0,
      };
      prev.qty += item.qty ?? 0;
      prev.revenue += (item.qty ?? 0) * (item.unitPrice ?? 0);
      map.set(key, prev);
    }
  }
  return [...map.values()].sort((a, b) => b.revenue - a.revenue || b.qty - a.qty);
}

export async function buildLiveSalesReport(period = "month") {
  const p = normalizeReportPeriod(period);
  const from = periodToDate(p);
  const query = from ? { createdAt: { $gte: from } } : {};

  const [saleDocs, products] = await Promise.all([
    SaleModel.find(query).sort({ createdAt: -1 }).limit(2000).lean(),
    ProductModel.find().lean(),
  ]);

  let total = 0;
  let pieces = 0;
  const byPayment = new Map();

  for (const doc of saleDocs) {
    const amount = saleNetAmount(doc);
    total += amount;
    const countPieces = doc.kind !== "warranty";
    if (countPieces) {
      for (const item of doc.items ?? []) {
        pieces += item.qty ?? 0;
      }
    }
    const label = paymentLabel(doc);
    byPayment.set(label, (byPayment.get(label) ?? 0) + amount);
  }

  const tickets = saleDocs.length;
  const starProducts = aggregateStarProducts(saleDocs).slice(0, 25);

  const outOfStock = [];
  const lowStock = [];
  for (const doc of products) {
    const p = docToProduct(doc);
    if (p.stock <= 0 || p.status === "vendido") {
      outOfStock.push({
        id: p.id,
        sku: p.sku,
        name: p.name,
        category: p.category,
        stock: p.stock,
        status: p.status,
      });
    } else if (p.stock <= 3) {
      lowStock.push({
        id: p.id,
        sku: p.sku,
        name: p.name,
        category: p.category,
        stock: p.stock,
        status: p.status,
      });
    }
  }

  outOfStock.sort((a, b) => a.name.localeCompare(b.name, "es"));
  lowStock.sort((a, b) => a.stock - b.stock || a.name.localeCompare(b.name, "es"));

  const recentSales = saleDocs.slice(0, 15).map((doc) => ({
    id: doc._id.toString(),
    at: doc.createdAt?.toISOString?.() ?? new Date().toISOString(),
    total: saleNetAmount(doc),
    pieces: (doc.items ?? []).reduce((s, i) => s + (i.qty ?? 0), 0),
    payment: doc.payment,
    orderCode: doc.orderCode,
  }));

  return {
    generatedAt: new Date().toISOString(),
    period: p,
    summary: {
      tickets,
      total,
      avgTicket: tickets > 0 ? total / tickets : 0,
      pieces,
    },
    byPayment: [...byPayment.entries()]
      .map(([label, amount]) => ({ label, amount }))
      .sort((a, b) => b.amount - a.amount),
    starProducts,
    outOfStock,
    lowStock,
    recentSales,
  };
}
