import { DamageModel, docToDamage } from "../models/Damage.js";
import { ProductModel, docToProduct } from "../models/Product.js";

const DAMAGE_REASONS = [
  "Cambio por garantía al cliente",
  "Daño al entregar / probar",
  "Defecto detectado en tienda",
  "Otro",
];

export { DAMAGE_REASONS };

export function assertCanReportDamage(product, qty) {
  if (product.status === "reservado") {
    throw new Error(
      `«${product.name}» está en un pedido. Libérala antes de reportar daño.`
    );
  }
  if (qty < 1) throw new Error("Indica cuántas piezas dañadas.");
  if (product.stock < qty) {
    throw new Error(
      `Stock insuficiente (hay ${product.stock}, reportas ${qty}).`
    );
  }
}

/** Pieza ya vendida que regresa por garantía (stock puede estar en 0). */
export function assertCanReportWarrantyReturn(product, qty) {
  if (product.status === "reservado") {
    throw new Error(
      `«${product.name}» sigue en un pedido. No se puede cerrar garantía así.`
    );
  }
  if (qty < 1) throw new Error("Indica cuántas piezas regresan dañadas.");
  if (product.stock >= qty) return;
  if (product.stock === 0 && qty === 1) return;
  throw new Error(
    `Cantidad inválida para garantía (stock ${product.stock}, reportas ${qty}).`
  );
}

export async function recordProductDamage(body, options = {}) {
  const {
    session,
    warrantyReturn = false,
    saleId,
    orderId,
    warrantyCaseId,
  } = options;

  const productId = body.productId;
  const qty = Math.floor(Number(body.qty));
  const reason = body.reason?.trim() || "Otro";
  const notes = body.notes?.trim() || undefined;

  const product = session
    ? await ProductModel.findById(productId).session(session)
    : await ProductModel.findById(productId);
  if (!product) throw new Error("Producto no encontrado.");

  if (warrantyReturn) {
    assertCanReportWarrantyReturn(product, qty);
    if (product.stock >= qty) {
      product.stock = Math.max(0, product.stock - qty);
    }
    if (product.stock === 0) {
      product.status = "danado";
    }
  } else {
    assertCanReportDamage(product, qty);
    product.stock = Math.max(0, product.stock - qty);
    if (product.stock === 0) {
      product.status = "danado";
    }
  }

  await product.save(session ? { session } : undefined);

  const damagePayload = {
    productId: product._id,
    sku: product.sku,
    name: product.name,
    qty,
    reason,
    notes,
    stockAfter: product.stock,
    saleId,
    orderId,
    warrantyCaseId,
  };

  const damageDoc = session
    ? (await DamageModel.create([damagePayload], { session }))[0]
    : await DamageModel.create(damagePayload);

  return {
    damage: docToDamage(damageDoc),
    product: docToProduct(product),
  };
}
