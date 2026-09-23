import type { WarrantyCaseRecord } from "@/types";

export function warrantyQtyUsedOnLine(
  history: WarrantyCaseRecord[],
  saleId: string,
  lineIndex: number
): number {
  return history
    .filter(
      (w) =>
        w.originalSaleId === saleId &&
        (w.originalLineIndex === lineIndex ||
          (w.originalLineIndex == null &&
            /* legacy sin índice: no sumar para evitar doble conteo */ false))
    )
    .reduce((sum, w) => sum + w.originalQty, 0);
}

/** Legacy: casos sin originalLineIndex pero mismo SKU y venta. */
export function warrantyQtyUsedOnLineLegacySku(
  history: WarrantyCaseRecord[],
  saleId: string,
  sku: string,
  unitPrice: number
): number {
  return history
    .filter(
      (w) =>
        w.originalSaleId === saleId &&
        w.originalLineIndex == null &&
        w.originalSku === sku &&
        w.originalUnitPrice === unitPrice
    )
    .reduce((sum, w) => sum + w.originalQty, 0);
}

export function remainingWarrantyQty(
  history: WarrantyCaseRecord[],
  saleId: string,
  lineIndex: number,
  lineQty: number,
  line?: { sku?: string; unitPrice: number }
): number {
  let used = warrantyQtyUsedOnLine(history, saleId, lineIndex);
  if (line && used === 0) {
    used = warrantyQtyUsedOnLineLegacySku(
      history,
      saleId,
      line.sku ?? "",
      line.unitPrice
    );
  }
  return Math.max(0, lineQty - used);
}
