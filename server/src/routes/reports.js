import { Router } from "express";
import { buildDayCloseSnapshot, todayDayKey } from "../lib/dayClose.js";
import { buildLiveSalesReport, normalizeReportPeriod } from "../lib/salesReport.js";
import { DayCloseModel, docToDayClose } from "../models/DayClose.js";

export const reportsRouter = Router();

reportsRouter.get("/live", async (req, res, next) => {
  try {
    const period = normalizeReportPeriod(req.query.period);
    const report = await buildLiveSalesReport(period);
    res.json(report);
  } catch (err) {
    next(err);
  }
});

reportsRouter.get("/day-closes", async (req, res, next) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 30, 1), 100);
    const docs = await DayCloseModel.find()
      .sort({ dayKey: -1 })
      .limit(limit)
      .lean();
    res.json(docs.map((d) => docToDayClose({ ...d, _id: d._id })));
  } catch (err) {
    next(err);
  }
});

reportsRouter.post("/day-close", async (req, res, next) => {
  try {
    const raw = req.body?.dayKey;
    const dayKey =
      typeof raw === "string" && raw.trim()
        ? raw.trim()
        : todayDayKey();
    const snapshot = await buildDayCloseSnapshot(dayKey);
    const closedAt = new Date();
    const doc = await DayCloseModel.findOneAndUpdate(
      { dayKey },
      {
        $set: {
          closedAt,
          summary: snapshot.summary,
          byPayment: snapshot.byPayment,
          byPriceTier: snapshot.byPriceTier,
        },
      },
      { upsert: true, new: true, runValidators: true }
    );
    res.json(docToDayClose(doc));
  } catch (err) {
    if (err.status === 400) {
      res.status(400).json({ error: err.message });
      return;
    }
    next(err);
  }
});
