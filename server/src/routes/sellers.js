import { Router } from "express";
import { SellerModel, docToSeller } from "../models/Seller.js";

export const sellersRouter = Router();

sellersRouter.get("/", async (_req, res, next) => {
  try {
    const docs = await SellerModel.find().sort({ name: 1 }).lean();
    res.json(docs.map((d) => docToSeller({ ...d, _id: d._id })));
  } catch (err) {
    next(err);
  }
});

sellersRouter.post("/", async (req, res, next) => {
  try {
    const name = req.body?.name?.trim();
    if (!name) {
      res.status(400).json({ error: "El nombre de la vendedora es obligatorio." });
      return;
    }
    const doc = await SellerModel.create({ name, active: true });
    res.status(201).json(docToSeller(doc));
  } catch (err) {
    next(err);
  }
});

sellersRouter.patch("/:id", async (req, res, next) => {
  try {
    const doc = await SellerModel.findById(req.params.id);
    if (!doc) {
      res.status(404).json({ error: "Vendedora no encontrada." });
      return;
    }
    const body = req.body ?? {};
    if (body.name !== undefined) {
      if (!body.name?.trim()) {
        res.status(400).json({ error: "El nombre no puede estar vacío." });
        return;
      }
      doc.name = body.name.trim();
    }
    if (body.active !== undefined) doc.active = Boolean(body.active);
    await doc.save();
    res.json(docToSeller(doc));
  } catch (err) {
    next(err);
  }
});
