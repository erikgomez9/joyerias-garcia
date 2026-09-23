import mongoose from "mongoose";

const damageSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    sku: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    qty: { type: Number, required: true, min: 1 },
    reason: { type: String, trim: true, default: "" },
    notes: { type: String, trim: true },
    stockAfter: { type: Number, min: 0 },
    saleId: { type: mongoose.Schema.Types.ObjectId, ref: "Sale" },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order" },
    warrantyCaseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "WarrantyCase",
    },
  },
  { timestamps: true }
);

damageSchema.index({ createdAt: -1 });

export const DamageModel = mongoose.model("Damage", damageSchema);

function toIso(value) {
  if (!value) return new Date().toISOString();
  if (value instanceof Date) return value.toISOString();
  return new Date(value).toISOString();
}

export function docToDamage(doc) {
  return {
    id: doc._id.toString(),
    productId: doc.productId.toString(),
    sku: doc.sku,
    name: doc.name,
    qty: doc.qty,
    reason: doc.reason ?? "",
    notes: doc.notes,
    stockAfter: doc.stockAfter,
    saleId: doc.saleId?.toString(),
    orderId: doc.orderId?.toString(),
    warrantyCaseId: doc.warrantyCaseId?.toString(),
    at: toIso(doc.createdAt),
  };
}
