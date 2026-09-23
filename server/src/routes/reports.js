import { Router } from "express";
import { buildLiveSalesReport, normalizeReportPeriod } from "../lib/salesReport.js";

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
