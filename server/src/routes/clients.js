import { Router } from "express";
import { ClientModel, docToClient } from "../models/Client.js";

export const clientsRouter = Router();

clientsRouter.get("/", async (_req, res, next) => {
  try {
    const docs = await ClientModel.find().sort({ name: 1 }).lean();
    res.json(docs.map((d) => docToClient({ ...d, _id: d._id })));
  } catch (err) {
    next(err);
  }
});

clientsRouter.post("/", async (req, res, next) => {
  try {
    const body = req.body ?? {};
    if (!body.name?.trim()) {
      res.status(400).json({ error: "El nombre del cliente es obligatorio." });
      return;
    }
    const doc = await ClientModel.create({
      name: body.name.trim(),
      phone: body.phone?.trim() ?? "",
      email: body.email?.trim() ?? "",
      notes: body.notes?.trim() || undefined,
    });
    res.status(201).json(docToClient(doc));
  } catch (err) {
    next(err);
  }
});

clientsRouter.patch("/:id", async (req, res, next) => {
  try {
    const body = req.body ?? {};
    const doc = await ClientModel.findById(req.params.id);
    if (!doc) {
      res.status(404).json({ error: "Cliente no encontrado." });
      return;
    }
    if (body.name !== undefined) {
      if (!body.name?.trim()) {
        res.status(400).json({ error: "El nombre no puede estar vacío." });
        return;
      }
      doc.name = body.name.trim();
    }
    if (body.phone !== undefined) doc.phone = body.phone?.trim() ?? "";
    if (body.email !== undefined) doc.email = body.email?.trim() ?? "";
    if (body.notes !== undefined) {
      doc.notes = body.notes?.trim() || undefined;
    }
    await doc.save();
    res.json(docToClient(doc));
  } catch (err) {
    next(err);
  }
});

clientsRouter.delete("/:id", async (req, res, next) => {
  try {
    const doc = await ClientModel.findByIdAndDelete(req.params.id);
    if (!doc) {
      res.status(404).json({ error: "Cliente no encontrado." });
      return;
    }
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
