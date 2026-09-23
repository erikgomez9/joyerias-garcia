import { useState } from "react";
import { formatMoney, metalLabel, productPrice } from "@/lib/format";
import type { Product } from "@/types";
import ui from "@/components/ui.module.css";
import styles from "./PosProductConfirm.module.css";

interface Props {
  product: Product;
  onConfirm: (qty: number) => void;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  confirmLabel?: string;
}

export function PosProductConfirm({
  product,
  onConfirm,
  onClose,
  title = "¿Es esta joya?",
  subtitle = "Revisa la foto y los datos antes de agregar al ticket.",
  confirmLabel = "Agregar al ticket",
}: Props) {
  const [qty, setQty] = useState(1);
  const max = product.stock;

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="pos-confirm-title"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className={styles.panel}>
        <h2 id="pos-confirm-title" className={styles.title}>
          {title}
        </h2>
        <p className={styles.sub}>{subtitle}</p>

        <div className={styles.body}>
          <div className={styles.imageWrap}>
            <img src={product.image} alt={product.name} />
          </div>
          <div className={styles.info}>
            <div className={styles.name}>{product.name}</div>
            <div className={styles.meta}>
              {product.category} · {metalLabel(product.metal, product.metalOther)}
            </div>
            {product.stones && (
              <div className={styles.meta}>Piedras: {product.stones}</div>
            )}
            <div className={styles.codes}>
              <span>SKU {product.sku}</span>
              <span>Barras {product.barcode}</span>
            </div>
            <div className={styles.prices}>
              <span>Menudeo {formatMoney(product.priceMenudeo)}</span>
              <span>Mayoreo {formatMoney(product.priceMayoreo)}</span>
            </div>
            <div className={styles.stock}>En existencia: {product.stock}</div>

            <label className={styles.qtyLabel}>
              Cantidad
              <div className={styles.qtyRow}>
                <button
                  type="button"
                  className={styles.qtyBtn}
                  disabled={qty <= 1}
                  onClick={() => setQty((n) => Math.max(1, n - 1))}
                >
                  −
                </button>
                <span className={styles.qtyVal}>{qty}</span>
                <button
                  type="button"
                  className={styles.qtyBtn}
                  disabled={qty >= max}
                  onClick={() => setQty((n) => Math.min(max, n + 1))}
                >
                  +
                </button>
              </div>
            </label>
            <div className={styles.lineTotal}>
              Subtotal línea (menudeo):{" "}
              <strong>
                {formatMoney(productPrice(product, "menudeo") * qty)}
              </strong>
            </div>
          </div>
        </div>

        <div className={styles.actions}>
          <button
            type="button"
            className={`${ui.btn} ${ui.btnGhost}`}
            onClick={onClose}
          >
            Cancelar
          </button>
          <button
            type="button"
            className={`${ui.btn} ${ui.btnPrimary}`}
            onClick={() => onConfirm(qty)}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
