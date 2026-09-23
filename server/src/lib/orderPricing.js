export const MAYOREO_MIN_TOTAL_MXN = 500;

export function orderMenudeoSubtotal(lines, productById) {
  return lines.reduce((s, line) => {
    if (line.productId) {
      const p = productById.get(String(line.productId));
      if (p) return s + p.priceMenudeo * line.qty;
    }
    return s + line.unitPrice * line.qty;
  }, 0);
}

export function priceTierForOrderLines(lines, productById) {
  const menudeo = orderMenudeoSubtotal(lines, productById);
  return menudeo >= MAYOREO_MIN_TOTAL_MXN ? "mayoreo" : "menudeo";
}

export function productUnitPrice(product, tier) {
  return tier === "mayoreo" ? product.priceMayoreo : product.priceMenudeo;
}

export function applyTierToOrderLines(lines, productById) {
  const tier = priceTierForOrderLines(lines, productById);
  return lines.map((line) => {
    if (!line.productId) return line;
    const p = productById.get(String(line.productId));
    if (!p) return line;
    return { ...line, unitPrice: productUnitPrice(p, tier) };
  });
}
