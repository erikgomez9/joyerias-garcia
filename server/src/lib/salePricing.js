/** A partir de este total (menudeo) se cobra todo el ticket a mayoreo. */
export const MAYOREO_MIN_TOTAL_MXN = 500;

/**
 * @param {{ productId?: unknown; qty: number; unitPrice: number }[]} lines
 * @param {Map<string, { priceMenudeo: number }>} productById
 */
export function priceTierForSaleLines(lines, productById) {
  let menudeo = 0;
  for (const line of lines) {
    const pid = line.productId?.toString();
    const product = pid ? productById.get(pid) : undefined;
    if (product) menudeo += product.priceMenudeo * line.qty;
    else menudeo += line.unitPrice * line.qty;
  }
  return menudeo >= MAYOREO_MIN_TOTAL_MXN ? "mayoreo" : "menudeo";
}
