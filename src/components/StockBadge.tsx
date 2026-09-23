import {
  stockBadgeText,
  stockVisualKind,
  type StockVisualKind,
} from "@/lib/stockDisplay";
import styles from "./StockBadge.module.css";

const CLASS: Record<StockVisualKind, string> = {
  out: styles.out,
  low: styles.low,
  ok: styles.ok,
};

interface Props {
  stock: number;
  status?: string;
  /** Muestra solo el badge cuando está agotado o bajo; si no, número normal. */
  emphasize?: boolean;
}

export function StockBadge({ stock, status, emphasize = true }: Props) {
  const kind = stockVisualKind({ stock, status });
  const text = stockBadgeText({ stock, status });

  if (emphasize && kind === "ok") {
    return <span className={styles.plain}>{stock}</span>;
  }

  return (
    <span
      className={`${styles.badge} ${CLASS[kind]}`}
      title={kind === "out" ? "Sin existencias" : undefined}
    >
      {kind === "out" && <span className={styles.dot} aria-hidden />}
      {text}
    </span>
  );
}
