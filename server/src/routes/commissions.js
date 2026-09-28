import { Router } from "express";
import { buildCommissionReport } from "../lib/commissions.js";
export const commissionsRouter = Router();

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function startOfNextDay(d) {
  const x = startOfDay(d);
  x.setDate(x.getDate() + 1);
  return x;
}

/** Quincena 1 = días 1–15; quincena 2 = 16–fin de mes. */
export function quincenaBoundsFromKey(key) {
  const m = /^(\d{4})-(\d{2})-(1|2)$/.exec(String(key).trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const half = m[3];
  if (half === "1") {
    const from = new Date(y, mo, 1, 0, 0, 0, 0);
    const to = new Date(y, mo, 16, 0, 0, 0, 0);
    return { from, to };
  }
  const from = new Date(y, mo, 16, 0, 0, 0, 0);
  const to = new Date(y, mo + 1, 1, 0, 0, 0, 0);
  return { from, to };
}

export function quincenaKeyForDate(d = new Date()) {
  const x = startOfDay(d);
  const y = x.getFullYear();
  const mo = String(x.getMonth() + 1).padStart(2, "0");
  const half = x.getDate() <= 15 ? "1" : "2";
  return `${y}-${mo}-${half}`;
}

export function previousQuincenaKey(key) {
  const bounds = quincenaBoundsFromKey(key);
  if (!bounds) return null;
  const prevDay = new Date(bounds.from);
  prevDay.setDate(prevDay.getDate() - 1);
  return quincenaKeyForDate(prevDay);
}

export function quincenaLabel(key) {
  const bounds = quincenaBoundsFromKey(key);
  if (!bounds) return key;
  const endDisplay = new Date(bounds.to);
  endDisplay.setDate(endDisplay.getDate() - 1);
  const fmt = (dt) =>
    dt.toLocaleDateString("es-MX", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  return `${fmt(bounds.from)} – ${fmt(endDisplay)}`;
}

commissionsRouter.get("/report", async (req, res, next) => {
  try {
    let key = String(req.query.quincena ?? "current").trim();
    if (key === "current") key = quincenaKeyForDate(new Date());
    if (key === "previous") {
      const cur = quincenaKeyForDate(new Date());
      const prev = previousQuincenaKey(cur);
      if (!prev) {
        res.status(400).json({ error: "No hay quincena anterior." });
        return;
      }
      key = prev;
    }
    const bounds = quincenaBoundsFromKey(key);
    if (!bounds) {
      res.status(400).json({ error: "Quincena inválida." });
      return;
    }
    const report = await buildCommissionReport(bounds.from, bounds.to);
    res.json({
      ...report,
      quincenaKey: key,
      quincenaLabel: quincenaLabel(key),
    });
  } catch (err) {
    next(err);
  }
});
