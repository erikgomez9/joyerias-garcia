import { applyTierToOrderLines } from "./orderPricing.js";
import { ProductModel } from "../models/Product.js";

export function itemsTotal(items) {
  return items.reduce((s, l) => s + l.unitPrice * l.qty, 0);
}

export function titleFromItems(items) {
  if (!items.length) return "Pedido";
  const first = items[0].name;
  if (items.length === 1) return first;
  return `${first} (+${items.length - 1})`;
}

export async function buildItemsFromBody(rawItems) {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    throw new Error("Agrega al menos una pieza o concepto al pedido.");
  }
  const lines = [];
  const productById = new Map();

  for (const raw of rawItems) {
    const qty = Math.floor(Number(raw.qty));
    if (qty < 1) throw new Error("Cantidad inválida en una línea.");
    const productId = raw.productId || undefined;
    let name = raw.name?.trim();
    let unitPrice = Number(raw.unitPrice);
    let sku;

    if (productId) {
      const product = await ProductModel.findById(productId);
      if (!product) throw new Error("Producto de inventario no encontrado.");
      if (product.stock < qty) {
        throw new Error(
          `Stock insuficiente para «${product.name}» (hay ${product.stock}).`
        );
      }
      productById.set(String(productId), product);
      name = product.name;
      sku = product.sku;
      unitPrice = product.priceMenudeo;
    } else {
      if (!name) throw new Error("Cada concepto necesita nombre.");
      if (!Number.isFinite(unitPrice) || unitPrice < 0) {
        throw new Error(`Precio inválido en «${name}».`);
      }
    }

    lines.push({
      productId: productId || undefined,
      sku,
      name,
      qty,
      unitPrice,
    });
  }

  return applyTierToOrderLines(lines, productById);
}

export function orderLinesHoldInventory(items) {
  return (items ?? []).some((line) => line.productId);
}

/** Pedido que ya descontó piezas del inventario (encargo con joyas). */
export function orderInventoryWasHeld(doc) {
  if (doc.inventoryHeld) return true;
  if (doc.kind === "apartado") return true;
  return orderLinesHoldInventory(doc.items);
}

export function orderShouldRestoreOnCancel(doc, prevStatus) {
  if (prevStatus === "entregado") return false;
  return orderInventoryWasHeld(doc);
}

/** Separa del stock disponible las piezas ligadas al pedido (encargo). */
export async function reserveOrderInventoryLines(items) {
  for (const line of items) {
    if (!line.productId) continue;
    const product = await ProductModel.findById(line.productId);
    if (!product) continue;
    const qty = line.qty ?? 1;
    if (product.stock < qty) {
      throw new Error(
        `Stock insuficiente para el pedido «${product.name}» (hay ${product.stock}).`
      );
    }
    product.stock -= qty;
    if (product.stock === 0) product.status = "reservado";
    await product.save();
  }
}

/** @deprecated alias */
export const reserveApartadoLines = reserveOrderInventoryLines;

export async function releaseOrderInventoryLines(
  items,
  legacyProductId,
  inventoryHeld
) {
  if (!inventoryHeld) return;
  const qtyByProduct = new Map();
  for (const line of items ?? []) {
    if (!line.productId) continue;
    const id = line.productId.toString();
    qtyByProduct.set(id, (qtyByProduct.get(id) ?? 0) + (line.qty ?? 1));
  }
  if (legacyProductId) {
    const id = legacyProductId.toString();
    if (!qtyByProduct.has(id)) qtyByProduct.set(id, 1);
  }

  for (const [id, qty] of qtyByProduct) {
    const product = await ProductModel.findById(id);
    if (!product) continue;
    product.stock += qty;
    if (product.stock > 0 && product.status === "reservado") {
      product.status = "disponible";
    }
    await product.save();
  }
}

/** @deprecated alias */
export async function releaseApartadoLines(items, legacyProductId, held) {
  return releaseOrderInventoryLines(items, legacyProductId, Boolean(held));
}

export async function deliverOrderInventoryLines(
  items,
  legacyProductId,
  inventoryHeld
) {
  const lines = [...(items ?? [])];
  if (legacyProductId && !lines.some((l) => l.productId?.toString() === legacyProductId.toString())) {
    lines.push({ productId: legacyProductId, qty: 1 });
  }
  for (const line of lines) {
    if (!line.productId) continue;
    const product = await ProductModel.findById(line.productId);
    if (!product) continue;
    const qty = line.qty ?? 1;
    if (inventoryHeld) {
      if (product.stock === 0) product.status = "vendido";
      else if (product.status === "reservado") product.status = "disponible";
    } else {
      product.stock = Math.max(0, product.stock - qty);
      product.status = product.stock === 0 ? "vendido" : product.status;
    }
    await product.save();
  }
}

/** @deprecated alias */
export async function deliverApartadoLines(items, legacyProductId, kindOrHeld) {
  const held =
    typeof kindOrHeld === "boolean"
      ? kindOrHeld
      : kindOrHeld === "apartado";
  return deliverOrderInventoryLines(items, legacyProductId, held);
}
