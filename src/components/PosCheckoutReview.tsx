import { formatMoney, productPrice } from "@/lib/format";
import { productDisplayName } from "@/lib/productSize";
import {
  cartTotal,
  priceTierForCart,
  priceTierHint,
  priceTierLabel,
} from "@/lib/salePricing";
import type { CartLine } from "@/types";
import ui from "@/components/ui.module.css";
import styles from "./PosCheckoutReview.module.css";

interface Props {
  lines: CartLine[];
  onBack: () => void;
  onContinue: () => void;
}

export function PosCheckoutReview({ lines, onBack, onContinue }: Props) {
  const tier = priceTierForCart(lines);
  const total = cartTotal(lines);
  const hint = priceTierHint(lines, tier);

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="checkout-review-title"
      onClick={(e) => e.target === e.currentTarget && onBack()}
    >
      <div className={styles.panel}>
        <h2 id="checkout-review-title" className={styles.title}>
          Revisar antes de cobrar
        </h2>
        <p className={styles.sub}>
          Confirma que las piezas del ticket son correctas.
        </p>

        <ul className={styles.list}>
          {lines.map((line) => (
            <li key={line.product.id} className={styles.line}>
              <img src={line.product.image} alt="" className={styles.thumb} />
              <div className={styles.lineBody}>
                <div className={styles.lineName}>
                  {productDisplayName(line.product)}
                </div>
                <div className={styles.lineMeta}>
                  {line.product.sku} · {line.qty} pza(s) ·{" "}
                  {formatMoney(productPrice(line.product, tier))} c/u
                </div>
              </div>
              <div className={styles.lineAmt}>
                {formatMoney(productPrice(line.product, tier) * line.qty)}
              </div>
            </li>
          ))}
        </ul>

        <p className={styles.hint}>{hint}</p>
        <div className={styles.totalRow}>
          <span>Total ({priceTierLabel(tier)})</span>
          <strong>{formatMoney(total)}</strong>
        </div>

        <div className={styles.actions}>
          <button type="button" className={`${ui.btn} ${ui.btnGhost}`} onClick={onBack}>
            Volver al ticket
          </button>
          <button
            type="button"
            className={`${ui.btn} ${ui.btnPrimary}`}
            onClick={onContinue}
          >
            Confirmar y cobrar
          </button>
        </div>
      </div>
    </div>
  );
}
