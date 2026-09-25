import mongoose from "mongoose";
import { resolveInventoryMode } from "../lib/inventoryMode.js";

const productSchema = new mongoose.Schema(
  {
    sku: { type: String, required: true, unique: true, index: true },
    barcode: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true },
    category: { type: String, required: true },
    metal: {
      type: String,
      enum: ["plata", "oro", "acero", "rodio", "oro_laminado", "otro"],
    },
    metalOther: { type: String, trim: true },
    stones: { type: String, trim: true },
    weightGrams: { type: Number, min: 0 },
    /** Talla (anillo) o longitud (cadena/pulsera), p. ej. "7", "45 cm" */
    size: { type: String, trim: true },
    priceMayoreo: { type: Number, required: true, min: 0 },
    priceMenudeo: { type: Number, required: true, min: 0 },
    inventoryMode: {
      type: String,
      enum: ["catalog", "unique"],
      default: "catalog",
    },
    stock: { type: Number, required: true, min: 0, default: 0 },
    status: {
      type: String,
      enum: ["disponible", "reservado", "vendido", "taller", "danado"],
      default: "disponible",
    },
    image: { type: String, default: "" },
    notes: { type: String, trim: true },
    inWebCatalog: { type: Boolean, default: false, index: true },
    /** Cuándo quedó sin stock (para ocultar del catálogo web tras 7 días). */
    catalogSoldOutSince: { type: Date },
    /** Oculta automáticamente del catálogo web; se limpia al reponer stock. */
    catalogWebHidden: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

productSchema.index({ name: "text", sku: "text", barcode: "text" });

export const ProductModel = mongoose.model("Product", productSchema);

const DEFAULT_IMAGE =
  "https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=400&q=80";

function toIso(value) {
  if (!value) return new Date().toISOString();
  if (value instanceof Date) return value.toISOString();
  return new Date(value).toISOString();
}

export function docToProduct(doc) {
  return {
    id: doc._id.toString(),
    sku: doc.sku,
    barcode: doc.barcode,
    name: doc.name,
    category: doc.category,
    metal: doc.metal,
    metalOther: doc.metalOther,
    stones: doc.stones,
    weightGrams: doc.weightGrams,
    size: doc.size?.trim() || undefined,
    priceMayoreo: doc.priceMayoreo,
    priceMenudeo: doc.priceMenudeo,
    inventoryMode: resolveInventoryMode(doc),
    stock: doc.stock,
    status: doc.status,
    image: doc.image || DEFAULT_IMAGE,
    notes: doc.notes,
    inWebCatalog: Boolean(doc.inWebCatalog),
    catalogSoldOutSince: doc.catalogSoldOutSince
      ? toIso(doc.catalogSoldOutSince)
      : undefined,
    createdAt: toIso(doc.createdAt),
    updatedAt: toIso(doc.updatedAt),
  };
}
