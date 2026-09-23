import { Router } from "express";
import { DamageModel, docToDamage } from "../models/Damage.js";
import { recordProductDamage } from "../lib/recordDamage.js";

export const damagesRouter = Router();

damagesRouter.get("/", async (_req, res, next) => {
  try {
    const docs = await DamageModel.find()
      .sort({ createdAt: -1 })
      .limit(300)
      .lean();
    res.json(
      docs.map((d) =>
        docToDamage({
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

damagesRouter.post("/", async (req, res, next) => {
  try {
    const result = await recordProductDamage(req.body ?? {});
    res.status(201).json(result);
  } catch (err) {
    const msg = err.message ?? "No se pudo registrar el daño.";
    res.status(400).json({ error: msg });
  }
});
