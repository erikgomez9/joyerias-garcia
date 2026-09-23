import { Router } from "express";
import { WarrantyCaseModel, docToWarranty } from "../models/WarrantyCase.js";
import { processWarranty } from "../lib/processWarranty.js";

export const warrantiesRouter = Router();

warrantiesRouter.get("/", async (_req, res, next) => {
  try {
    const docs = await WarrantyCaseModel.find()
      .sort({ createdAt: -1 })
      .limit(300)
      .lean();
    res.json(
      docs.map((d) =>
        docToWarranty({
          ...d,
          _id: d._id,
          createdAt: d.createdAt,
        })
      )
    );
  } catch (err) {
    next(err);
  }
});

warrantiesRouter.post("/", async (req, res, next) => {
  try {
    const result = await processWarranty(req.body ?? {});
    res.status(201).json(result);
  } catch (err) {
    const msg = err.message ?? "No se pudo registrar la garantía.";
    res.status(400).json({ error: msg });
  }
});
