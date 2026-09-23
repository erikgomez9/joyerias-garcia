import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";
import type { Product } from "@/types";
import { formatMoney, metalLabel } from "@/lib/format";
import styles from "./ProductLabel.module.css";

interface Props {
  product: Product;
  onClose: () => void;
}

export function ProductLabel({ product, onClose }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current) return;
    JsBarcode(svgRef.current, product.barcode, {
      format: "EAN13",
      width: 2,
      height: 56,
      displayValue: true,
      fontSize: 14,
      margin: 8,
      background: "#ffffff",
      lineColor: "#111111",
    });
  }, [product.barcode]);

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true">
      <div className={styles.panel}>
        <div className={styles.toolbar}>
          <h3>Etiqueta de inventario</h3>
          <div className={styles.actions}>
            <button type="button" className={styles.btn} onClick={onClose}>
              Cerrar
            </button>
            <button
              type="button"
              className={styles.btnPrimary}
              onClick={() => window.print()}
            >
              Imprimir
            </button>
          </div>
        </div>

        <div className={styles.labelSheet} id="print-label">
          <div className={styles.brand}>Joyerías García</div>
          <div className={styles.name}>{product.name}</div>
          <div className={styles.meta}>
            {product.category}
            {product.metal
              ? ` · ${metalLabel(product.metal, product.metalOther)}`
              : ""}
            {product.weightGrams
              ? ` · ${product.weightGrams} g`
              : ""}
          </div>
          <div className={styles.sku}>SKU {product.sku}</div>
          <div className={styles.prices}>
            <div className={styles.priceRow}>
              <span>Mayoreo</span>
              <strong>{formatMoney(product.priceMayoreo)}</strong>
            </div>
            <div className={styles.priceRow}>
              <span>Menudeo</span>
              <strong className={styles.priceMain}>
                {formatMoney(product.priceMenudeo)}
              </strong>
            </div>
          </div>
          <svg ref={svgRef} className={styles.barcode} />
        </div>
      </div>
    </div>
  );
}
