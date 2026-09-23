import { formatMoney, formatDate } from "@/lib/format";
import { orderLinesTotal } from "@/lib/orderLabels";
import type { OrderLine, OrderPayment } from "@/types";
import styles from "./OrderItemsTable.module.css";

interface Props {
  items: OrderLine[];
  depositPaid?: number;
  payments?: OrderPayment[];
  showTotals?: boolean;
}

export function OrderItemsTable({
  items,
  depositPaid = 0,
  payments = [],
  showTotals = true,
}: Props) {
  const total = orderLinesTotal(items);
  const saldo = Math.max(0, total - depositPaid);
  const paidComplete = saldo <= 0 && total > 0;

  if (items.length === 0) {
    return <p className={styles.empty}>Sin piezas en el pedido.</p>;
  }

  return (
    <div className={styles.wrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Concepto</th>
            <th>Cant.</th>
            <th>P. unit.</th>
            <th>Importe</th>
          </tr>
        </thead>
        <tbody>
          {items.map((line, i) => (
            <tr key={`${line.name}-${i}`}>
              <td>
                <div className={styles.name}>{line.name}</div>
                {line.sku && (
                  <div className={styles.sku}>{line.sku}</div>
                )}
              </td>
              <td>{line.qty}</td>
              <td>{formatMoney(line.unitPrice)}</td>
              <td>{formatMoney(line.unitPrice * line.qty)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {showTotals && (
        <>
          <div className={styles.totals}>
            <div className={styles.totalRow}>
              <span>Total del pedido</span>
              <strong>{formatMoney(total)}</strong>
            </div>
            <div className={`${styles.totalRow} ${styles.paidRow}`}>
              <span>Abonado</span>
              <strong>{formatMoney(depositPaid)}</strong>
            </div>
            <div
              className={`${styles.totalRow} ${styles.saldoRow} ${paidComplete ? styles.saldoCero : ""}`}
            >
              <span>Saldo pendiente</span>
              <strong>{formatMoney(saldo)}</strong>
            </div>
          </div>

          {payments.length > 0 && (
            <div className={styles.paymentsBlock}>
              <h4 className={styles.paymentsTitle}>Historial de abonos</h4>
              <ul className={styles.paymentsList}>
                {payments.map((p, i) => (
                  <li key={`${p.paidAt}-${i}`} className={styles.paymentItem}>
                    <span className={styles.paymentAmount}>
                      +{formatMoney(p.amount)}
                    </span>
                    <span className={styles.paymentDate}>
                      {formatDate(p.paidAt)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
