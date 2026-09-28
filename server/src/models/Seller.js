import mongoose from "mongoose";

const sellerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

sellerSchema.index({ name: 1 });
sellerSchema.index({ active: 1, name: 1 });

export const SellerModel = mongoose.model("Seller", sellerSchema);

function toIso(value) {
  if (!value) return new Date().toISOString();
  if (value instanceof Date) return value.toISOString();
  return new Date(value).toISOString();
}

export function docToSeller(doc) {
  return {
    id: doc._id.toString(),
    name: doc.name,
    active: doc.active !== false,
    createdAt: toIso(doc.createdAt),
    updatedAt: toIso(doc.updatedAt),
  };
}
