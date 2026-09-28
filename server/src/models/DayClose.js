import mongoose from "mongoose";

const moneyRowSchema = new mongoose.Schema(
  {
    label: { type: String, required: true, trim: true },
    amount: { type: Number, required: true },
  },
  { _id: false }
);

const summarySchema = new mongoose.Schema(
  {
    tickets: { type: Number, required: true, min: 0 },
    total: { type: Number, required: true },
    avgTicket: { type: Number, required: true, min: 0 },
    pieces: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const dayCloseSchema = new mongoose.Schema(
  {
    dayKey: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
    },
    closedAt: { type: Date, required: true },
    summary: { type: summarySchema, required: true },
    byPayment: { type: [moneyRowSchema], default: [] },
    byPriceTier: { type: [moneyRowSchema], default: [] },
  },
  { timestamps: true }
);

dayCloseSchema.index({ dayKey: -1 });

export const DayCloseModel = mongoose.model("DayClose", dayCloseSchema);

function toIso(value) {
  if (!value) return new Date().toISOString();
  if (value instanceof Date) return value.toISOString();
  return new Date(value).toISOString();
}

export function docToDayClose(doc) {
  return {
    id: doc._id.toString(),
    dayKey: doc.dayKey,
    closedAt: toIso(doc.closedAt),
    summary: doc.summary,
    byPayment: doc.byPayment ?? [],
    byPriceTier: doc.byPriceTier ?? [],
    createdAt: toIso(doc.createdAt),
    updatedAt: toIso(doc.updatedAt),
  };
}
