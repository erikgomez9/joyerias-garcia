import { Router } from "express";
import mongoose from "mongoose";
import { assertSellableAtPos } from "../lib/productAvailability.js";
import { validatePaymentMix } from "../lib/paymentMix.js";
import { priceTierForSaleLines } from "../lib/salePricing.js";
import { touchWebCatalogOnStockChange } from "../lib/webCatalog.js";
import { ProductModel } from "../models/Product.js";
import { SaleModel, docToSale } from "../models/Sale.js";

export const salesRouter = Router();

salesRouter.get("/", async (_req, res, next) => {
  try {
    const docs = await SaleModel.find().sort({ createdAt: -1 }).limit(500).lean();
    res.json(
      docs.map((d) =>
        docToSale({
          ...d,
          _id: d._id,
          createdAt: d.createdAt,
          items: d.items,
        })
      )
    );
  } catch (err) {
    next(err);
  }
});

salesRouter.post("/checkout", async (req, res, next) => {
  const session = await mongoose.startSession();
  try {
    const body = req.body ?? {};
    const payment = body.payment;
    const items = body.items;
    const validPay = ["efectivo", "tarjeta", "transferencia", "mixto"];
    if (!validPay.includes(payment)) {
      res.status(400).json({ error: "Forma de pago no válida." });
      return;
    }
    if (!Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: "El ticket está vacío." });
      return;
    }

    let saleDoc;
    await session.withTransaction(async () => {
      const lineItems = [];
      const productById = new Map();
      let total = 0;

      for (const raw of items) {
        const productId = raw.productId;
        const qty = Math.floor(Number(raw.qty));
        const unitPrice = Number(raw.unitPrice);
        if (!productId || qty < 1 || unitPrice < 0) {
          throw new Error("Línea de venta inválida.");
        }

        const product = await ProductModel.findById(productId).session(session);
        if (!product) {
          throw new Error(`Producto no encontrado: ${productId}`);
        }
        assertSellableAtPos(product, qty);
        productById.set(product._id.toString(), product);

        product.stock -= qty;
        if (product.stock === 0) product.status = "vendido";
        touchWebCatalogOnStockChange(product);
        await product.save({ session });

        lineItems.push({
          productId: product._id,
          sku: product.sku,
          name: product.size?.trim()
            ? `${product.name} · ${product.size.trim()}`
            : product.name,
          qty,
          unitPrice,
          metal: product.metal,
          metalOther: product.metalOther,
          unitCost: product.priceMayoreo,
        });
        total += unitPrice * qty;
      }

      let paymentMix;
      if (payment === "mixto") {
        paymentMix = validatePaymentMix(body.paymentMix, total);
      }

      const priceTier = priceTierForSaleLines(lineItems, productById);

      const created = await SaleModel.create(
        [
          {
            total,
            payment,
            paymentMix,
            seller: body.seller?.trim() || "Mostrador",
            items: lineItems,
            priceTier,
          },
        ],
        { session }
      );
      saleDoc = created[0];
    });

    res.status(201).json(docToSale(saleDoc));
  } catch (err) {
    const msg = err.message ?? "No se pudo completar la venta.";
    res.status(400).json({ error: msg });
  } finally {
    session.endSession();
  }
});
