import { Router } from "express";
import {
  generateJewelryCode,
  isValidJewelryCode,
  normalizeJewelryCode,
} from "../lib/inventoryCodes.js";
import {
  normalizeStock,
  validateInventoryBody,
} from "../lib/inventoryMode.js";
import { touchWebCatalogOnStockChange } from "../lib/webCatalog.js";
import { ProductModel, docToProduct } from "../models/Product.js";

export const productsRouter = Router();

productsRouter.get("/", async (_req, res, next) => {
  try {
    const docs = await ProductModel.find().sort({ createdAt: -1 }).lean();
    res.json(docs.map((d) => docToProduct({ ...d, _id: d._id })));
  } catch (err) {
    next(err);
  }
});

productsRouter.post("/", async (req, res, next) => {
  try {
    const body = req.body ?? {};
    if (!body.name?.trim()) {
      res.status(400).json({ error: "El nombre es obligatorio." });
      return;
    }
    if (body.metal === "otro" && !body.metalOther?.trim()) {
      res.status(400).json({ error: "Indica el material cuando eliges otro." });
      return;
    }
    const stockError = validateInventoryBody(body);
    if (stockError) {
      res.status(400).json({ error: stockError });
      return;
    }
    const { inventoryMode, stock } = normalizeStock(body);

    const existing = await ProductModel.find(
      {},
      { sku: 1, barcode: 1 }
    ).lean();
    const category = body.category ?? "Otros";
    let sku;
    let barcode;
    const manualSku = body.sku?.trim();
    const manualBarcode = body.barcode?.trim();
    if (manualSku || manualBarcode) {
      sku = normalizeJewelryCode(manualSku || manualBarcode);
      barcode = normalizeJewelryCode(manualBarcode || manualSku);
      if (!isValidJewelryCode(sku)) {
        res.status(400).json({
          error:
            "Código inválido. Usa dos letras de categoría y números (ej. AR001, CD042).",
        });
        return;
      }
      if (sku !== barcode) {
        res.status(400).json({
          error: "SKU y código de barras deben ser el mismo valor.",
        });
        return;
      }
      const taken = await ProductModel.findOne({
        $or: [{ sku }, { barcode }],
      });
      if (taken) {
        res.status(409).json({ error: "Ese código ya existe en inventario." });
        return;
      }
    } else {
      const code = generateJewelryCode(category, existing);
      sku = code;
      barcode = code;
    }

    const doc = await ProductModel.create({
      sku,
      barcode,
      name: body.name.trim(),
      category: body.category ?? "Otros",
      metal: body.metal,
      metalOther:
        body.metal === "otro" ? body.metalOther?.trim() : undefined,
      stones: body.stones?.trim() || undefined,
      weightGrams: body.weightGrams,
      size: body.size?.trim() || undefined,
      priceMayoreo: Number(body.priceMayoreo) || 0,
      priceMenudeo: Number(body.priceMenudeo) || 0,
      inventoryMode,
      stock,
      status: body.status ?? "disponible",
      image: body.image?.trim() || "",
      notes: body.notes?.trim() || undefined,
      inWebCatalog: Boolean(body.inWebCatalog),
    });
    touchWebCatalogOnStockChange(doc);
    await doc.save();

    res.status(201).json(docToProduct(doc));
  } catch (err) {
    next(err);
  }
});

productsRouter.patch("/:id", async (req, res, next) => {
  try {
    const body = req.body ?? {};
    if (body.metal === "otro" && body.metalOther !== undefined && !body.metalOther?.trim()) {
      res.status(400).json({ error: "Indica el material cuando eliges otro." });
      return;
    }

    const current = await ProductModel.findById(req.params.id);
    if (!current) {
      res.status(404).json({ error: "Producto no encontrado." });
      return;
    }

    const merged = {
      inventoryMode: body.inventoryMode ?? current.inventoryMode ?? "catalog",
      stock: body.stock !== undefined ? body.stock : current.stock,
    };
    const stockError = validateInventoryBody(merged);
    if (stockError) {
      res.status(400).json({ error: stockError });
      return;
    }
    const normalized = normalizeStock({
      ...merged,
      inventoryMode: merged.inventoryMode,
      stock: merged.stock,
    });

    const patch = {};
    if (body.name !== undefined) patch.name = body.name.trim();
    if (body.category !== undefined) patch.category = body.category;
    if (body.metal !== undefined) {
      patch.metal = body.metal;
      patch.metalOther =
        body.metal === "otro"
          ? body.metalOther?.trim() || undefined
          : undefined;
    } else if (body.metalOther !== undefined) {
      patch.metalOther = body.metalOther.trim() || undefined;
    }
    if (body.stones !== undefined) patch.stones = body.stones.trim() || undefined;
    if (body.weightGrams !== undefined) patch.weightGrams = body.weightGrams;
    if (body.size !== undefined) patch.size = body.size.trim() || undefined;
    if (body.priceMayoreo !== undefined) patch.priceMayoreo = body.priceMayoreo;
    if (body.priceMenudeo !== undefined) patch.priceMenudeo = body.priceMenudeo;
    if (body.inventoryMode !== undefined || body.stock !== undefined) {
      patch.inventoryMode = normalized.inventoryMode;
      patch.stock = normalized.stock;
    }
    if (body.status !== undefined) patch.status = body.status;
    if (body.image !== undefined) patch.image = body.image.trim();
    if (body.notes !== undefined) patch.notes = body.notes.trim() || undefined;
    if (body.inWebCatalog !== undefined) {
      patch.inWebCatalog = Boolean(body.inWebCatalog);
    }

    if (body.sku !== undefined || body.barcode !== undefined) {
      const sku = normalizeJewelryCode(
        body.sku?.trim() || body.barcode?.trim() || ""
      );
      const barcode = normalizeJewelryCode(
        body.barcode?.trim() || body.sku?.trim() || ""
      );
      if (!isValidJewelryCode(sku)) {
        res.status(400).json({
          error:
            "Código inválido. Usa dos letras de categoría y números (ej. AR001, CD042).",
        });
        return;
      }
      if (sku !== barcode) {
        res.status(400).json({
          error: "SKU y código de barras deben ser el mismo valor.",
        });
        return;
      }
      const taken = await ProductModel.findOne({
        _id: { $ne: current._id },
        $or: [{ sku }, { barcode }],
      });
      if (taken) {
        res.status(409).json({ error: "Ese código ya existe en inventario." });
        return;
      }
      patch.sku = sku;
      patch.barcode = barcode;
    }

    const doc = await ProductModel.findByIdAndUpdate(
      req.params.id,
      { $set: patch },
      { new: true, runValidators: true }
    );
    if (
      body.inWebCatalog !== undefined ||
      body.stock !== undefined ||
      patch.stock !== undefined
    ) {
      touchWebCatalogOnStockChange(doc);
      await doc.save();
    }
    res.json(docToProduct(doc));
  } catch (err) {
    next(err);
  }
});

productsRouter.patch("/:id/stock", async (req, res, next) => {
  try {
    const delta = Number(req.body?.delta);
    if (!Number.isFinite(delta)) {
      res.status(400).json({ error: "delta numérico requerido." });
      return;
    }
    const doc = await ProductModel.findById(req.params.id);
    if (!doc) {
      res.status(404).json({ error: "Producto no encontrado." });
      return;
    }
    doc.stock = Math.max(0, doc.stock + delta);
    if (doc.stock === 0 && doc.status === "disponible") {
      doc.status = "vendido";
    } else if (
      doc.stock > 0 &&
      (doc.status === "vendido" || doc.status === "danado")
    ) {
      doc.status = "disponible";
    }
    touchWebCatalogOnStockChange(doc);
    await doc.save();
    res.json(docToProduct(doc));
  } catch (err) {
    next(err);
  }
});

productsRouter.delete("/:id", async (req, res, next) => {
  try {
    const doc = await ProductModel.findByIdAndDelete(req.params.id);
    if (!doc) {
      res.status(404).json({ error: "Producto no encontrado." });
      return;
    }
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
