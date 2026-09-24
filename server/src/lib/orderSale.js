import { ProductModel } from "../models/Product.js";
import { SaleModel, docToSale } from "../models/Sale.js";
import { priceTierForSaleLines } from "./salePricing.js";

function saleLineFromOrderItem(i, product) {
  return {
    productId: i.productId,
    sku: i.sku?.trim() || "CONCEPTO",
    name: i.name,
    qty: i.qty,
    unitPrice: i.unitPrice,
    metal: product?.metal,
    metalOther: product?.metalOther,
    unitCost: product?.priceMayoreo,
  };
}

/** Venta contable al entregar; el stock ya se ajustó en el pedido. */
export async function createSaleFromOrder(orderDoc) {
  if (orderDoc.saleId) {
    const existing = await SaleModel.findById(orderDoc.saleId);
    if (existing) return docToSale(existing);
  }

  const rawItems = orderDoc.items ?? [];
  const productIds = [
    ...new Set(
      rawItems
        .map((i) => i.productId?.toString())
        .filter(Boolean)
    ),
  ];
  const products = productIds.length
    ? await ProductModel.find({ _id: { $in: productIds } }).lean()
    : [];
  const productById = new Map(products.map((p) => [p._id.toString(), p]));

  const items = rawItems.map((i) => {
    const pid = i.productId?.toString();
    const product = pid ? productById.get(pid) : undefined;
    return saleLineFromOrderItem(i, product);
  });

  if (items.length === 0) {
    throw new Error("El pedido no tiene líneas para registrar la venta.");
  }

  const priceTier = priceTierForSaleLines(items, productById);

  const sale = await SaleModel.create({
    total: orderDoc.totalAmount,
    payment: "pedido",
    seller: "Mostrador",
    orderId: orderDoc._id,
    orderCode: orderDoc.orderCode,
    items,
    priceTier,
  });

  orderDoc.saleId = sale._id;
  return docToSale(sale);
}
