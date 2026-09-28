import { SaleModel } from "../models/Sale.js";
import {
  dayBoundsFromKey,
  dayKeyFromDate,
  summarizeSaleDocs,
} from "./salesReport.js";

export async function buildDayCloseSnapshot(dayKey) {
  const bounds = dayBoundsFromKey(dayKey);
  if (!bounds) {
    const err = new Error("Fecha de cierre inválida (usa AAAA-MM-DD).");
    err.status = 400;
    throw err;
  }

  const saleDocs = await SaleModel.find({
    createdAt: { $gte: bounds.from, $lt: bounds.to },
  })
    .sort({ createdAt: -1 })
    .lean();

  const { summary, byPayment, byPriceTier } = summarizeSaleDocs(saleDocs);

  return {
    dayKey,
    summary,
    byPayment,
    byPriceTier,
    saleCount: saleDocs.length,
  };
}

export function todayDayKey() {
  return dayKeyFromDate(new Date());
}
