import mongoose from "mongoose";

const clientSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, default: "", trim: true },
    email: { type: String, default: "", trim: true },
    notes: { type: String, trim: true },
  },
  { timestamps: true }
);

clientSchema.index({ name: 1 });
clientSchema.index({ phone: 1 });

export const ClientModel = mongoose.model("Client", clientSchema);

export function docToClient(doc) {
  return {
    id: doc._id.toString(),
    name: doc.name,
    phone: doc.phone ?? "",
    email: doc.email ?? "",
    notes: doc.notes,
    createdAt: doc.createdAt?.toISOString?.() ?? new Date().toISOString(),
    updatedAt: doc.updatedAt?.toISOString?.() ?? new Date().toISOString(),
  };
}
