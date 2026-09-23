import { useState } from "react";
import { DAMAGE_REASONS } from "@/lib/damageReasons";
import { metalLabel } from "@/lib/format";
import type { Product } from "@/types";
import ui from "@/components/ui.module.css";
import styles from "./PosProductConfirm.module.css";

interface Props {
  product: Product;
  submitting?: boolean;
  onConfirm: (payload: { qty: number; reason: string; notes: string }) => void;
  onClose: () => void;
}

export function DamageReportDialog({
  product,
  submitting = false,
  onConfirm,
  onClose,
}: Props) {
  const [qty, setQty] = useState(1);
  const [reason, setReason] = useState<string>(DAMAGE_REASONS[0]);
  const [notes, setNotes] = useState("");
  const max = product.stock;

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="damage-report-title"
      onClick={(e) => e.target === e.currentTarget && !submitting && onClose()}
    >
      <div className={styles.panel}>
        <h2 id="damage-report-title" className={styles.title}>
          Reportar pieza dañada
        </h2>
        <p className={styles.sub}>
          Se restará del inventario. Si el stock llega a cero, la joya quedará
          marcada como dañada.
        </p>

        <div className={styles.body}>
          <div className={styles.imageWrap}>
            <img src={product.image} alt={product.name} />
          </div>
          <div className={styles.info}>
            <div className={styles.name}>{product.name}</div>
            <div className={styles.meta}>
              {product.category} · {metalLabel(product.metal, product.metalOther)}
            </div>
            <div className={styles.codes}>
              <span>SKU {product.sku}</span>
              {product.barcode ? <span>Barras {product.barcode}</span> : null}
            </div>
            <div className={styles.stock}>En existencia: {product.stock}</div>

            <label className={styles.qtyLabel}>
              Piezas dañadas
              <div className={styles.qtyRow}>
                <button
                  type="button"
                  className={styles.qtyBtn}
                  disabled={qty <= 1 || submitting}
                  onClick={() => setQty((n) => Math.max(1, n - 1))}
                >
                  −
                </button>
                <span className={styles.qtyVal}>{qty}</span>
                <button
                  type="button"
                  className={styles.qtyBtn}
                  disabled={qty >= max || submitting}
                  onClick={() => setQty((n) => Math.min(max, n + 1))}
                >
                  +
                </button>
              </div>
            </label>

            <label className={styles.qtyLabel} style={{ marginTop: "0.75rem" }}>
              Motivo
              <select
                className={ui.select}
                value={reason}
                disabled={submitting}
                onChange={(e) => setReason(e.target.value)}
              >
                {DAMAGE_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>

            <label className={styles.qtyLabel} style={{ marginTop: "0.5rem" }}>
              Notas (opcional)
              <textarea
                className={ui.input}
                rows={2}
                value={notes}
                disabled={submitting}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ej. cambio en venta del 12/03, cliente María…"
              />
            </label>
          </div>
        </div>

        <div className={styles.actions}>
          <button
            type="button"
            className={`${ui.btn} ${ui.btnGhost}`}
            disabled={submitting}
            onClick={onClose}
          >
            Cancelar
          </button>
          <button
            type="button"
            className={`${ui.btn} ${ui.btnPrimary}`}
            disabled={submitting || max < 1}
            onClick={() =>
              onConfirm({ qty, reason, notes: notes.trim() })
            }
          >
            {submitting ? "Registrando…" : "Registrar daño"}
          </button>
        </div>
      </div>
    </div>
  );
}
