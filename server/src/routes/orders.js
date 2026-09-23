import { Router } from "express";
import { generateOrderCode } from "../lib/orderCodes.js";
import { createSaleFromOrder } from "../lib/orderSale.js";
import {
  buildItemsFromBody,
  deliverOrderInventoryLines,
  itemsTotal,
  releaseOrderInventoryLines,
  orderInventoryWasHeld,
  orderLinesHoldInventory,
  orderShouldRestoreOnCancel,
  reserveOrderInventoryLines,
  titleFromItems,
} from "../lib/orderItems.js";
import { ClientModel } from "../models/Client.js";
import { OrderModel, docToOrder } from "../models/Order.js";

export const ordersRouter = Router();

const STATUSES = ["pendiente", "en_taller", "listo", "entregado", "cancelado"];

async function resolveClientFields(body) {
  let clientName = body.clientName?.trim() ?? "";
  let clientPhone = body.clientPhone?.trim() ?? "";
  const clientId = body.clientId;

  if (clientId) {
    const client = await ClientModel.findById(clientId);
    if (!client) throw new Error("Cliente no encontrado.");
    clientName = client.name;
    clientPhone = client.phone ?? clientPhone;
  }

  if (!clientName) {
    throw new Error("Indica el cliente (nombre o cliente registrado).");
  }
  return { clientId: clientId || undefined, clientName, clientPhone };
}

ordersRouter.get("/", async (_req, res, next) => {
  try {
    const docs = await OrderModel.find().sort({ createdAt: -1 }).limit(500).lean();
    res.json(docs.map((d) => docToOrder({ ...d, _id: d._id })));
  } catch (err) {
    next(err);
  }
});

ordersRouter.post("/", async (req, res, next) => {
  try {
    const body = req.body ?? {};
    const kind = "encargo";

    const items = await buildItemsFromBody(body.items);
    const totalAmount = itemsTotal(items);
    const depositPaid = Math.max(0, Number(body.depositPaid) || 0);
    if (depositPaid > totalAmount) {
      res.status(400).json({ error: "Lo pagado hoy no puede superar el total." });
      return;
    }

    const clientFields = await resolveClientFields(body);
    const existing = await OrderModel.find({}, { orderCode: 1 }).lean();
    const orderCode = generateOrderCode(existing);

    const title = body.title?.trim() || titleFromItems(items);
    const firstWithProduct = items.find((i) => i.productId);

    const payments =
      depositPaid > 0 ? [{ amount: depositPaid, paidAt: new Date() }] : [];

    const doc = await OrderModel.create({
      orderCode,
      ...clientFields,
      kind,
      title,
      description: body.description?.trim() || undefined,
      items,
      productId: firstWithProduct?.productId,
      productName: firstWithProduct?.name,
      totalAmount,
      depositPaid,
      payments,
      status: "pendiente",
      inventoryHeld: false,
    });

    if (orderLinesHoldInventory(items)) {
      await reserveOrderInventoryLines(items);
      doc.inventoryHeld = true;
      await doc.save();
    }

    res.status(201).json(docToOrder(doc));
  } catch (err) {
    const msg = err.message ?? "No se pudo crear el pedido.";
    res.status(400).json({ error: msg });
  }
});

ordersRouter.patch("/:id", async (req, res, next) => {
  try {
    const body = req.body ?? {};
    const doc = await OrderModel.findById(req.params.id);
    if (!doc) {
      res.status(404).json({ error: "Pedido no encontrado." });
      return;
    }

    if (body.status !== undefined) {
      if (!STATUSES.includes(body.status)) {
        res.status(400).json({ error: "Estado no válido." });
        return;
      }
      if (body.status === "en_taller") {
        res.status(400).json({ error: "Usa Pendiente o Listo; el estado taller ya no aplica." });
        return;
      }
      const prev =
        doc.status === "en_taller" ? "pendiente" : doc.status;
      if (doc.status === "en_taller") doc.status = "pendiente";
      doc.status = body.status;
      if (body.status === "cancelado" && prev !== "cancelado") {
        if (orderShouldRestoreOnCancel(doc, prev)) {
          await releaseOrderInventoryLines(doc.items, doc.productId, true);
          doc.inventoryHeld = false;
        }
      }
      if (body.status === "entregado" && prev !== "entregado") {
        const saldo = Math.max(
          0,
          Math.round((doc.totalAmount - (doc.depositPaid ?? 0)) * 100) / 100
        );
        if (saldo > 0) {
          res.status(400).json({
            error: `No se puede entregar: saldo pendiente de $${saldo.toFixed(2)}. Registra el pago completo antes.`,
          });
          return;
        }
        await deliverOrderInventoryLines(
          doc.items,
          doc.productId,
          orderInventoryWasHeld(doc)
        );
        await createSaleFromOrder(doc);
      }
    }

    if (body.items !== undefined) {
      if (doc.status === "cancelado" || doc.status === "entregado") {
        res.status(400).json({ error: "No se pueden editar líneas en este estado." });
        return;
      }
      if (orderInventoryWasHeld(doc)) {
        await releaseOrderInventoryLines(doc.items, doc.productId, true);
      }
      const items = await buildItemsFromBody(body.items);
      doc.items = items;
      doc.totalAmount = itemsTotal(items);
      doc.title = titleFromItems(items);
      const firstWithProduct = items.find((i) => i.productId);
      doc.productId = firstWithProduct?.productId;
      doc.productName = firstWithProduct?.name;
      if (doc.depositPaid > doc.totalAmount) {
        res.status(400).json({
          error: "El total quedó menor a lo que el cliente ya pagó.",
        });
        return;
      }
      if (orderLinesHoldInventory(items)) {
        await reserveOrderInventoryLines(items);
        doc.inventoryHeld = true;
      } else {
        doc.inventoryHeld = false;
      }
    }

    if (body.description !== undefined) {
      doc.description = body.description?.trim() || undefined;
    }

    await doc.save();
    res.json(docToOrder(doc));
  } catch (err) {
    const msg = err.message ?? "No se pudo actualizar el pedido.";
    res.status(400).json({ error: msg });
  }
});

ordersRouter.post("/:id/deposit", async (req, res, next) => {
  try {
    const amount = Number(req.body?.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      res.status(400).json({ error: "Monto de abono inválido." });
      return;
    }
    const doc = await OrderModel.findById(req.params.id);
    if (!doc) {
      res.status(404).json({ error: "Pedido no encontrado." });
      return;
    }
    if (doc.status === "cancelado" || doc.status === "entregado") {
      res.status(400).json({ error: "No se pueden registrar abonos en este estado." });
      return;
    }
    const nextDeposit = doc.depositPaid + amount;
    if (nextDeposit > doc.totalAmount) {
      res.status(400).json({
        error: `El abono excede el saldo (faltan ${doc.totalAmount - doc.depositPaid}).`,
      });
      return;
    }
    doc.depositPaid = nextDeposit;
    doc.payments = doc.payments ?? [];
    doc.payments.push({ amount, paidAt: new Date() });
    await doc.save();
    res.json(docToOrder(doc));
  } catch (err) {
    next(err);
  }
});
