import mongoose from "mongoose";

const orderPaymentSchema = new mongoose.Schema(
  {
    amount: { type: Number, required: true, min: 0 },
    paidAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const orderItemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
    sku: { type: String },
    name: { type: String, required: true, trim: true },
    qty: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    orderCode: { type: String, required: true, unique: true },
    clientId: { type: mongoose.Schema.Types.ObjectId, ref: "Client" },
    clientName: { type: String, required: true, trim: true },
    clientPhone: { type: String, default: "", trim: true },
    kind: {
      type: String,
      enum: ["encargo", "apartado", "reparacion"],
      required: true,
    },
    status: {
      type: String,
      enum: ["pendiente", "en_taller", "listo", "entregado", "cancelado"],
      default: "pendiente",
    },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    items: { type: [orderItemSchema], default: [] },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
    productName: { type: String, trim: true },
    totalAmount: { type: Number, required: true, min: 0 },
    depositPaid: { type: Number, default: 0, min: 0 },
    payments: { type: [orderPaymentSchema], default: [] },
    saleId: { type: mongoose.Schema.Types.ObjectId, ref: "Sale" },
    /** Piezas del inventario ya descontadas al crear/editar el pedido. */
    inventoryHeld: { type: Boolean, default: false },
    dueDate: { type: Date },
    notes: { type: String, trim: true },
  },
  { timestamps: true }
);

orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ clientId: 1 });

export const OrderModel = mongoose.model("Order", orderSchema);

function toIso(value) {
  if (!value) return undefined;
  if (value instanceof Date) return value.toISOString();
  return new Date(value).toISOString();
}

function mapItems(items) {
  if (!Array.isArray(items)) return [];
  return items.map((i) => ({
    productId: i.productId?.toString(),
    sku: i.sku,
    name: i.name,
    qty: i.qty,
    unitPrice: i.unitPrice,
  }));
}

function mapPayments(doc) {
  const raw = doc.payments ?? [];
  if (raw.length > 0) {
    return raw.map((p) => ({
      amount: p.amount,
      paidAt: toIso(p.paidAt) ?? new Date().toISOString(),
    }));
  }
  if (doc.depositPaid > 0) {
    return [
      {
        amount: doc.depositPaid,
        paidAt: toIso(doc.createdAt) ?? new Date().toISOString(),
      },
    ];
  }
  return [];
}

/** Estado legacy en BD; en la app ya no se usa el paso «taller». */
function normalizeOrderStatus(status) {
  return status === "en_taller" ? "pendiente" : status;
}

export function docToOrder(doc) {
  const items = mapItems(doc.items);
  const firstProduct = items.find((i) => i.productId);
  return {
    id: doc._id.toString(),
    orderCode: doc.orderCode,
    clientId: doc.clientId?.toString(),
    clientName: doc.clientName,
    clientPhone: doc.clientPhone ?? "",
    kind: doc.kind,
    status: normalizeOrderStatus(doc.status),
    title: doc.title,
    description: doc.description,
    items,
    productId: doc.productId?.toString() ?? firstProduct?.productId,
    productName: doc.productName ?? firstProduct?.name,
    totalAmount: doc.totalAmount,
    depositPaid: doc.depositPaid ?? 0,
    payments: mapPayments(doc),
    saleId: doc.saleId?.toString(),
    inventoryHeld: Boolean(doc.inventoryHeld),
    dueDate: toIso(doc.dueDate),
    notes: doc.notes,
    createdAt: toIso(doc.createdAt) ?? new Date().toISOString(),
    updatedAt: toIso(doc.updatedAt) ?? new Date().toISOString(),
  };
}
