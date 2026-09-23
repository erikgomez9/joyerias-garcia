import { SaleModel, docToSale } from "../models/Sale.js";

/** Venta contable al entregar; el stock ya se ajustó en el pedido. */
export async function createSaleFromOrder(orderDoc) {
  if (orderDoc.saleId) {
    const existing = await SaleModel.findById(orderDoc.saleId);
    if (existing) return docToSale(existing);
  }

  const items = (orderDoc.items ?? []).map((i) => ({
    productId: i.productId,
    sku: i.sku?.trim() || "CONCEPTO",
    name: i.name,
    qty: i.qty,
    unitPrice: i.unitPrice,
  }));

  if (items.length === 0) {
    throw new Error("El pedido no tiene líneas para registrar la venta.");
  }

  const sale = await SaleModel.create({
    total: orderDoc.totalAmount,
    payment: "pedido",
    seller: "Mostrador",
    orderId: orderDoc._id,
    orderCode: orderDoc.orderCode,
    items,
  });

  orderDoc.saleId = sale._id;
  return docToSale(sale);
}
