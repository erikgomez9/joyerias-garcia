import { Router } from "express";
import {
  catalogSoldOutExpired,
  hideFromWebCatalogAfterGrace,
  isCatalogSoldOut,
  shouldListOnWebCatalog,
  toPublicCatalogItem,
} from "../lib/webCatalog.js";
import {
  CatalogWebSettingsModel,
  docToCatalogWebSettings,
  getOrCreateCatalogWebSettings,
} from "../models/CatalogWebSettings.js";
import { ProductModel } from "../models/Product.js";

export const catalogWebRouter = Router();

async function resolveSettingsBySlug(slug) {
  const normalized = slug?.trim()?.toLowerCase();
  if (!normalized) return null;
  return CatalogWebSettingsModel.findOne({ slug: normalized });
}

async function expireStaleCatalogProducts() {
  const candidates = await ProductModel.find({
    catalogWebHidden: { $ne: true },
    stock: { $lte: 0 },
    catalogSoldOutSince: { $exists: true, $ne: null },
  });
  const now = new Date();
  for (const doc of candidates) {
    if (catalogSoldOutExpired(doc, now)) {
      hideFromWebCatalogAfterGrace(doc);
      await doc.save();
    }
  }
}

/** Catálogo público (sin login). ?precios=1|0 */
catalogWebRouter.get("/public/:slug", async (req, res, next) => {
  try {
    const settings = await resolveSettingsBySlug(req.params.slug);
    if (!settings) {
      res.status(404).json({ error: "Catálogo no encontrado." });
      return;
    }

    await expireStaleCatalogProducts();

    const preciosParam = String(req.query.precios ?? "1").toLowerCase();
    const showPrices = !["0", "false", "no", "sin"].includes(preciosParam);

    const docs = await ProductModel.find({}).sort({
      category: 1,
      name: 1,
    });

    for (const doc of docs) {
      if (
        isCatalogSoldOut(doc) &&
        !doc.catalogWebHidden &&
        !doc.catalogSoldOutSince
      ) {
        doc.catalogSoldOutSince = doc.updatedAt ?? new Date();
        await doc.save();
      }
    }

    const now = new Date();
    const items = docs
      .filter((d) => shouldListOnWebCatalog(d, now))
      .map((d) => toPublicCatalogItem(d, showPrices));

    res.json({
      title: settings.title ?? "Joyerías García",
      slug: settings.slug,
      showPrices,
      updatedAt: new Date().toISOString(),
      items,
    });
  } catch (err) {
    next(err);
  }
});

catalogWebRouter.get("/settings", async (_req, res, next) => {
  try {
    const doc = await getOrCreateCatalogWebSettings();
    res.json(docToCatalogWebSettings(doc));
  } catch (err) {
    next(err);
  }
});

catalogWebRouter.patch("/settings", async (req, res, next) => {
  try {
    const doc = await getOrCreateCatalogWebSettings();
    const body = req.body ?? {};
    if (body.title !== undefined) {
      doc.title = String(body.title).trim() || "Joyerías García";
    }
    if (body.slug !== undefined) {
      const slug = String(body.slug).trim().toLowerCase();
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
        res.status(400).json({
          error: "El enlace solo puede usar letras minúsculas, números y guiones.",
        });
        return;
      }
      const taken = await CatalogWebSettingsModel.findOne({
        slug,
        _id: { $ne: doc._id },
      });
      if (taken) {
        res.status(409).json({ error: "Ese enlace ya está en uso." });
        return;
      }
      doc.slug = slug;
    }
    await doc.save();
    res.json(docToCatalogWebSettings(doc));
  } catch (err) {
    next(err);
  }
});
