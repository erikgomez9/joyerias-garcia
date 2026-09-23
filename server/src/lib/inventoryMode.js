export function normalizeStock(body) {
  const mode = body.inventoryMode === "unique" ? "unique" : "catalog";
  if (mode === "unique") {
    return { inventoryMode: "unique", stock: 1 };
  }
  const stock = Math.max(1, Math.floor(Number(body.stock) || 0));
  return { inventoryMode: "catalog", stock };
}

export function validateInventoryBody(body) {
  const mode = body.inventoryMode === "unique" ? "unique" : "catalog";
  if (mode === "unique" && body.stock !== undefined && Number(body.stock) !== 1) {
    return "Pieza única: el stock debe ser 1.";
  }
  if (mode === "catalog" && body.stock !== undefined && Number(body.stock) < 1) {
    return "Modelo repetido: stock mínimo 1.";
  }
  return null;
}

export function resolveInventoryMode(doc) {
  if (doc.inventoryMode) return doc.inventoryMode;
  return doc.stock > 1 ? "catalog" : "unique";
}
