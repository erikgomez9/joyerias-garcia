import { formatMoney, formatDate } from "@/lib/format";
import { formatPaymentMix } from "@/lib/paymentMix";
import type { SaleRecord } from "@/types";
import styles from "./SaleReceipt.module.css";

interface Props {
  sale: SaleRecord;
  onClose: () => void;
}

export function SaleReceipt({ sale, onClose }: Props) {
  return (
    <div className={styles.overlay} role="dialog" aria-modal="true">
      <div className={styles.panel}>
        <div className={styles.toolbar}>
          <h3>Venta registrada</h3>
          <div className={styles.actions}>
            <button type="button" className={styles.btn} onClick={onClose}>
              Cerrar
            </button>
            <button
              type="button"
              className={styles.btnPrimary}
              onClick={() => window.print()}
            >
              Imprimir ticket
            </button>
          </div>
        </div>

        <div className={`${styles.ticket} ${styles.ticketPrint}`} id="print-receipt">
          <div className={styles.brand}>Joyerías García</div>
          <div className={styles.meta}>{formatDate(sale.at)}</div>
          <div className={styles.meta}>
            Pago:{" "}
            {sale.payment === "mixto" && sale.paymentMix
              ? formatPaymentMix(sale.paymentMix)
              : sale.payment}
          </div>
          <hr className={styles.rule} />
          <ul className={styles.lines}>
            {sale.items.map((item, i) => (
              <li key={`${item.name}-${i}`}>
                <span>
                  {item.qty}× {item.name}
                </span>
                <span>{formatMoney(item.unitPrice * item.qty)}</span>
              </li>
            ))}
          </ul>
          <hr className={styles.rule} />
          <div className={styles.total}>
            <span>Total</span>
            <span>{formatMoney(sale.total)}</span>
          </div>
          <p className={styles.thanks}>Gracias por su compra</p>
        </div>
      </div>
    </div>
  );
}
