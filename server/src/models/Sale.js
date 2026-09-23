import mongoose from "mongoose";

const saleItemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
    sku: { type: String, required: true },
    name: { type: String, required: true },
    qty: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const paymentMixSchema = new mongoose.Schema(
  {
    efectivo: { type: Number, min: 0 },
    tarjeta: { type: Number, min: 0 },
    transferencia: { type: Number, min: 0 },
  },
  { _id: false }
);

const saleSchema = new mongoose.Schema(
  {
    total: { type: Number, required: true, min: 0 },
    payment: {
      type: String,
      enum: ["efectivo", "tarjeta", "transferencia", "mixto", "pedido"],
      required: true,
    },
    paymentMix: { type: paymentMixSchema, required: false },
    seller: { type: String, default: "Mostrador" },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order" },
    orderCode: { type: String, trim: true },
    kind: {
      type: String,
      enum: ["normal", "warranty"],
      default: "normal",
    },
    warrantyType: {
      type: String,
      enum: ["exchange_same", "exchange_diff", "refund"],
    },
    originalSaleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Sale",
    },
    warrantyCaseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "WarrantyCase",
    },
    items: { type: [saleItemSchema], required: true },
  },
  { timestamps: true }
);

saleSchema.index({ createdAt: -1 });

export const SaleModel = mongoose.model("Sale", saleSchema);

function toIso(value) {
  if (!value) return new Date().toISOString();
  if (value instanceof Date) return value.toISOString();
  return new Date(value).toISOString();
}

function paymentMixToJson(mix) {
  if (!mix) return undefined;
  const out = {};
  if (mix.efectivo > 0) out.efectivo = mix.efectivo;
  if (mix.tarjeta > 0) out.tarjeta = mix.tarjeta;
  if (mix.transferencia > 0) out.transferencia = mix.transferencia;
  return Object.keys(out).length ? out : undefined;
}

export function docToSale(doc) {
  return {
    id: doc._id.toString(),
    at: toIso(doc.createdAt),
    total: doc.total,
    payment: doc.payment,
    paymentMix: paymentMixToJson(doc.paymentMix),
    seller: doc.seller,
    orderId: doc.orderId?.toString(),
    orderCode: doc.orderCode,
    kind: doc.kind ?? "normal",
    warrantyType: doc.warrantyType,
    originalSaleId: doc.originalSaleId?.toString(),
    warrantyCaseId: doc.warrantyCaseId?.toString(),
    items: doc.items.map((i) => ({
      productId: i.productId?.toString(),
      name: i.name,
      sku: i.sku,
      qty: i.qty,
      unitPrice: i.unitPrice,
    })),
  };
}
