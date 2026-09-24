import mongoose from "mongoose";
import { recordProductDamage } from "./recordDamage.js";
import { assertSellableAtPos } from "./productAvailability.js";
import { validatePaymentMix } from "./paymentMix.js";
import { ProductModel } from "../models/Product.js";
import { SaleModel, docToSale } from "../models/Sale.js";
import { WarrantyCaseModel, docToWarranty } from "../models/WarrantyCase.js";

const VALID_TYPES = ["same_value", "price_difference", "refund"];
const VALID_PAY = ["efectivo", "tarjeta", "transferencia", "mixto"];

function pickTier(body) {
  return body.priceTier === "mayoreo" ? "mayoreo" : "menudeo";
}

function unitPriceForProduct(product, tier) {
  return tier === "mayoreo" ? product.priceMayoreo : product.priceMenudeo;
}

function resolveSaleLine(sale, lineIndex, lineSku) {
  const items = sale.items ?? [];
  if (lineIndex != null && items[lineIndex]) {
    return { line: items[lineIndex], index: lineIndex };
  }
  if (lineSku) {
    const upper = lineSku.trim().toUpperCase();
    const index = items.findIndex(
      (i) => (i.sku ?? "").toUpperCase() === upper
    );
    if (index >= 0) return { line: items[index], index };
  }
  throw new Error("No se encontró la línea de la venta original.");
}

async function resolveReturnedProduct(line, returnedProductId, session) {
  if (returnedProductId) {
    const p = await ProductModel.findById(returnedProductId).session(session);
    if (p) return p;
  }
  if (line.productId) {
    const p = await ProductModel.findById(line.productId).session(session);
    if (p) return p;
  }
  const sku = line.sku?.trim();
  if (sku) {
    const p = await ProductModel.findOne({ sku }).session(session);
    if (p) return p;
  }
  throw new Error(
    "No se pudo identificar el producto devuelto. Revisa el inventario (SKU)."
  );
}

async function shipReplacement(product, qty, session) {
  assertSellableAtPos(product, qty);
  product.stock -= qty;
  if (product.stock === 0) product.status = "vendido";
  await product.save({ session });
}

export async function processWarranty(body) {
  const type = body.type;
  if (!VALID_TYPES.includes(type)) {
    throw new Error("Tipo de garantía no válido.");
  }

  const originalSaleId = body.originalSaleId;
  if (!originalSaleId) throw new Error("Indica la venta original.");

  const lineIndex =
    body.originalLineIndex != null
      ? Math.floor(Number(body.originalLineIndex))
      : undefined;

  const session = await mongoose.startSession();
  let result;

  await session.withTransaction(async () => {
    const sale = await SaleModel.findById(originalSaleId).session(session);
    if (!sale) throw new Error("Venta original no encontrada.");

    const { line, index: resolvedLineIndex } = resolveSaleLine(
      sale,
      lineIndex,
      body.originalLineSku
    );
    const lineQty = line.qty ?? 1;
    const returnQty = Math.min(
      Math.max(1, Math.floor(Number(body.returnQty ?? 1))),
      lineQty
    );

    const priorCases = await WarrantyCaseModel.find({
      originalSaleId: sale._id,
      originalLineIndex: resolvedLineIndex,
    }).session(session);
    const alreadyReturned = priorCases.reduce(
      (sum, c) => sum + (c.originalQty ?? 0),
      0
    );
    const replacementQty = Math.max(
      1,
      Math.floor(Number(body.replacementQty ?? returnQty))
    );
    if (replacementQty !== returnQty && type !== "refund") {
      throw new Error(
        "Las piezas de reemplazo deben ser la misma cantidad que las defectuosas."
      );
    }

    if (alreadyReturned + returnQty > lineQty) {
      const left = Math.max(0, lineQty - alreadyReturned);
      throw new Error(
        left === 0
          ? `Ya se registró garantía por las ${lineQty} pieza(s) de esta línea.`
          : `Solo puedes reportar ${left} pieza(s) más en esta línea (vendiste ${lineQty}, ya en garantía ${alreadyReturned}).`
      );
    }

    const returnedProduct = await resolveReturnedProduct(
      line,
      body.returnedProductId,
      session
    );

    const originalLineTotal = (line.unitPrice ?? 0) * returnQty;

    let replacementProduct = null;
    let chargedAmount = 0;
    let refundAmount = 0;
    let warrantyType;
    let adjustmentSale = null;

    if (type === "refund") {
      warrantyType = "refund";
      refundAmount =
        body.refundAmount != null
          ? Math.max(0, Number(body.refundAmount))
          : originalLineTotal;
      if (refundAmount <= 0) {
        throw new Error("Indica el monto a reembolsar.");
      }
    } else {
      const replacementId = body.replacementProductId;
      if (!replacementId) {
        throw new Error("Escanea la joya de reemplazo.");
      }
      replacementProduct = await ProductModel.findById(replacementId).session(
        session
      );
      if (!replacementProduct) {
        throw new Error("Producto de reemplazo no encontrado.");
      }

      const tier = pickTier(body);
      const newUnit = unitPriceForProduct(replacementProduct, tier);
      const newTotal = newUnit * replacementQty;
      const credit = (line.unitPrice ?? 0) * returnQty;

      if (type === "same_value") {
        if (newTotal !== credit) {
          const paid = line.unitPrice ?? 0;
          throw new Error(
            `Cambio mismo valor: lo pagado (${paid} × ${returnQty} = ${credit}) no coincide con la joya nueva en ${tier} (${newUnit} × ${replacementQty} = ${newTotal}). Usa «Cambio con diferencia» o elige otra pieza/lista.`
          );
        }
        warrantyType = "exchange_same";
        chargedAmount = 0;
      } else {
        warrantyType = "exchange_diff";
        chargedAmount =
          body.chargedAmount != null
            ? Math.max(0, Number(body.chargedAmount))
            : Math.max(0, newTotal - credit);
      }
    }

    const warrantyDoc = await WarrantyCaseModel.create(
      [
        {
          type,
          originalSaleId: sale._id,
          originalOrderId: sale.orderId,
          originalLineIndex: resolvedLineIndex,
          originalSku: line.sku,
          originalName: line.name,
          originalQty: returnQty,
          originalUnitPrice: line.unitPrice ?? 0,
          returnedProductId: returnedProduct._id,
          replacementProductId: replacementProduct?._id,
          replacementQty: replacementProduct ? replacementQty : undefined,
          chargedAmount,
          refundAmount,
          notes: body.notes?.trim() || undefined,
        },
      ],
      { session }
    );
    const warrantyCase = warrantyDoc[0];

    const damageResult = await recordProductDamage(
      {
        productId: returnedProduct._id.toString(),
        qty: returnQty,
        reason: "Cambio por garantía al cliente",
        notes: body.notes?.trim() || undefined,
      },
      {
        session,
        warrantyReturn: true,
        saleId: sale._id,
        orderId: sale.orderId,
        warrantyCaseId: warrantyCase._id,
      }
    );

    warrantyCase.damageId = new mongoose.Types.ObjectId(
      damageResult.damage.id
    );
    await warrantyCase.save({ session });

    if (type === "refund") {
      const payment = VALID_PAY.includes(body.payment)
        ? body.payment
        : "efectivo";
      let paymentMix;
      if (payment === "mixto") {
        paymentMix = validatePaymentMix(body.paymentMix, refundAmount);
      }

      const created = await SaleModel.create(
        [
          {
            total: refundAmount,
            payment,
            paymentMix,
            seller: body.seller?.trim() || "Mostrador",
            kind: "warranty",
            warrantyType: "refund",
            originalSaleId: sale._id,
            warrantyCaseId: warrantyCase._id,
            orderId: sale.orderId,
            orderCode: sale.orderCode,
            priceTier: sale.priceTier,
            items: [
              {
                productId: returnedProduct._id,
                sku: line.sku,
                name: `Reembolso garantía · ${line.name}`,
                qty: returnQty,
                unitPrice: refundAmount / returnQty,
                metal: returnedProduct.metal ?? line.metal,
                metalOther: returnedProduct.metalOther ?? line.metalOther,
                unitCost:
                  returnedProduct.priceMayoreo ?? line.unitCost,
              },
            ],
          },
        ],
        { session }
      );
      adjustmentSale = created[0];
    } else {
      await shipReplacement(replacementProduct, replacementQty, session);

      const payment =
        chargedAmount > 0 && VALID_PAY.includes(body.payment)
          ? body.payment
          : "efectivo";
      let paymentMix;
      if (chargedAmount > 0 && payment === "mixto") {
        paymentMix = validatePaymentMix(body.paymentMix, chargedAmount);
      }

      const unitOnTicket =
        replacementQty > 0 ? chargedAmount / replacementQty : 0;

      const created = await SaleModel.create(
        [
          {
            total: chargedAmount,
            payment,
            paymentMix,
            seller: body.seller?.trim() || "Mostrador",
            kind: "warranty",
            warrantyType,
            originalSaleId: sale._id,
            warrantyCaseId: warrantyCase._id,
            orderId: sale.orderId,
            orderCode: sale.orderCode,
            priceTier: sale.priceTier,
            items: [
              {
                productId: replacementProduct._id,
                sku: replacementProduct.sku,
                name: replacementProduct.name,
                qty: replacementQty,
                unitPrice: unitOnTicket,
                metal: replacementProduct.metal,
                metalOther: replacementProduct.metalOther,
                unitCost: replacementProduct.priceMayoreo,
              },
            ],
          },
        ],
        { session }
      );
      adjustmentSale = created[0];
    }

    warrantyCase.adjustmentSaleId = adjustmentSale._id;
    await warrantyCase.save({ session });

    result = {
      warranty: docToWarranty(warrantyCase),
      damage: damageResult.damage,
      adjustmentSale: docToSale(adjustmentSale),
      returnedProduct: damageResult.product,
    };
  });

  return result;
}
