import mongoose from "mongoose";

const warrantySchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["same_value", "price_difference", "refund"],
      required: true,
    },
    originalSaleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Sale",
      required: true,
    },
    originalOrderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
    },
    originalLineIndex: { type: Number, min: 0 },
    originalSku: { type: String, required: true },
    originalName: { type: String, required: true, trim: true },
    originalQty: { type: Number, required: true, min: 1 },
    originalUnitPrice: { type: Number, required: true, min: 0 },
    returnedProductId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
    },
    replacementProductId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
    },
    replacementQty: { type: Number, min: 1, default: 1 },
    chargedAmount: { type: Number, min: 0, default: 0 },
    refundAmount: { type: Number, min: 0, default: 0 },
    payment: {
      type: String,
      enum: ["efectivo", "tarjeta", "transferencia", "mixto"],
    },
    paymentMix: {
      efectivo: { type: Number, min: 0 },
      tarjeta: { type: Number, min: 0 },
      transferencia: { type: Number, min: 0 },
    },
    damageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Damage",
    },
    adjustmentSaleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Sale",
    },
    notes: { type: String, trim: true },
  },
  { timestamps: true }
);

warrantySchema.index({ createdAt: -1 });
warrantySchema.index({ originalSaleId: 1 });

export const WarrantyCaseModel = mongoose.model("WarrantyCase", warrantySchema);

function toIso(value) {
  if (!value) return new Date().toISOString();
  if (value instanceof Date) return value.toISOString();
  return new Date(value).toISOString();
}

export function docToWarranty(doc) {
  return {
    id: doc._id.toString(),
    type: doc.type,
    originalSaleId: doc.originalSaleId.toString(),
    originalOrderId: doc.originalOrderId?.toString(),
    originalLineIndex: doc.originalLineIndex,
    originalSku: doc.originalSku,
    originalName: doc.originalName,
    originalQty: doc.originalQty,
    originalUnitPrice: doc.originalUnitPrice,
    returnedProductId: doc.returnedProductId?.toString(),
    replacementProductId: doc.replacementProductId?.toString(),
    replacementQty: doc.replacementQty ?? 1,
    chargedAmount: doc.chargedAmount ?? 0,
    refundAmount: doc.refundAmount ?? 0,
    payment: doc.payment,
    damageId: doc.damageId?.toString(),
    adjustmentSaleId: doc.adjustmentSaleId?.toString(),
    notes: doc.notes,
    at: toIso(doc.createdAt),
  };
}
