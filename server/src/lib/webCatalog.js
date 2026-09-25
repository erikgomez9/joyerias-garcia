/** Tiempo que una pieza agotada sigue visible en el catálogo web. */
export const CATALOG_SOLD_OUT_GRACE_DAYS = 7;

const GRACE_MS = CATALOG_SOLD_OUT_GRACE_DAYS * 24 * 60 * 60 * 1000;

export function isCatalogSoldOut(product) {
  return (product.stock ?? 0) <= 0;
}

/** Actualiza fechas de agotado al cambiar stock (sobre documento mongoose). */
export function touchWebCatalogOnStockChange(doc) {
  if (isCatalogSoldOut(doc)) {
    if (!doc.catalogSoldOutSince) {
      doc.catalogSoldOutSince = new Date();
    }
  } else {
    doc.catalogSoldOutSince = undefined;
    doc.catalogWebHidden = false;
  }
}

export function catalogSoldOutExpired(doc, now = new Date()) {
  if (!isCatalogSoldOut(doc)) return false;
  if (!doc.catalogSoldOutSince) return false;
  const since = new Date(doc.catalogSoldOutSince).getTime();
  return now.getTime() - since >= GRACE_MS;
}

/** Oculta del catálogo web tras la gracia (no borra del inventario). */
export function hideFromWebCatalogAfterGrace(doc) {
  doc.catalogWebHidden = true;
  doc.catalogSoldOutSince = undefined;
}

/** Todo el inventario entra al catálogo salvo ocultas por regla de agotado. */
export function shouldListOnWebCatalog(doc, now = new Date()) {
  if (doc.catalogWebHidden) return false;
  if (catalogSoldOutExpired(doc, now)) return false;
  return true;
}

export function toPublicCatalogItem(doc, showPrices) {
  const soldOut = isCatalogSoldOut(doc);
  const item = {
    id: doc._id.toString(),
    name: doc.name,
    category: doc.category,
    metal: doc.metal,
    metalOther: doc.metalOther,
    stones: doc.stones,
    size: doc.size?.trim() || undefined,
    image: doc.image,
    sku: doc.sku,
    soldOut,
    soldOutLabel: soldOut ? "Agotada" : undefined,
  };
  if (showPrices) {
    item.priceMayoreo = doc.priceMayoreo;
    item.priceMenudeo = doc.priceMenudeo;
  }
  return item;
}
