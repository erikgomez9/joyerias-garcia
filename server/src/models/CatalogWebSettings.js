import mongoose from "mongoose";
import crypto from "node:crypto";

const catalogWebSettingsSchema = new mongoose.Schema(
  {
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    title: { type: String, default: "Joyerías García", trim: true },
  },
  { timestamps: true }
);

export const CatalogWebSettingsModel = mongoose.model(
  "CatalogWebSettings",
  catalogWebSettingsSchema
);

function randomSlugPart() {
  return crypto.randomBytes(3).toString("hex");
}

export async function getOrCreateCatalogWebSettings() {
  let doc = await CatalogWebSettingsModel.findOne();
  if (!doc) {
    doc = await CatalogWebSettingsModel.create({
      slug: `joyerias-${randomSlugPart()}`,
    });
  }
  return doc;
}

export function docToCatalogWebSettings(doc) {
  return {
    slug: doc.slug,
    title: doc.title ?? "Joyerías García",
    updatedAt: doc.updatedAt?.toISOString?.() ?? new Date().toISOString(),
  };
}
