/** Piezas que se pueden agregar al punto de venta (no apartadas ni vendidas). */
export function assertSellableAtPos(product, qty) {
  if (product.status !== "disponible") {
    throw new Error(
      `«${product.name}» está apartada o no disponible en mostrador.`
    );
  }
  if (product.stock < qty) {
    throw new Error(
      `Stock insuficiente para «${product.name}» (hay ${product.stock}, pides ${qty}).`
    );
  }
}
