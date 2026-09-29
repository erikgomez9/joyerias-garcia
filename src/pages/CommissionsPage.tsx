import { Fragment, useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { usePos } from "@/context/PosContext";
import { commissionsApi, isMongoApiAvailable } from "@/lib/api";
import { buildCommissionReportLocal } from "@/lib/commissionsLocal";
import {
  downloadCommissionCsv,
  formatCommissionRate,
} from "@/lib/exportCommissions";
import { formatDate, formatMoney } from "@/lib/format";
import {
  quincenaKeyForDate,
  resolveQuincenaKey,
  type QuincenaFilter,
} from "@/lib/quincena";
import type { CommissionReport } from "@/types/commissions";
import ui from "@/components/ui.module.css";
import styles from "./CommissionsPage.module.css";

const FILTERS: { id: QuincenaFilter; label: string }[] = [
  { id: "current", label: "Quincena actual" },
  { id: "previous", label: "Quincena anterior" },
];

export function CommissionsPage() {
  const { sales, inventorySource } = usePos();
  const [filter, setFilter] = useState<QuincenaFilter>("current");
  const [report, setReport] = useState<CommissionReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const key = resolveQuincenaKey(filter);
      const mongo = await isMongoApiAvailable();
      if (mongo && inventorySource === "mongo") {
        const data = await commissionsApi.report(filter);
        setReport(data);
      } else {
        const data = buildCommissionReportLocal(sales, key);
        setReport(data);
      }
    } catch (err) {
      setReport(null);
      setError(
        err instanceof Error ? err.message : "No se pudo cargar comisiones."
      );
    } finally {
      setLoading(false);
    }
  }, [filter, sales, inventorySource]);

  useEffect(() => {
    void load();
  }, [load]);

  const currentKey = quincenaKeyForDate();

  return (
    <div className={styles.page}>
      <h1 className={ui.pageTitle}>Comisiones</h1>
      <p className={ui.pageDesc}>
        {formatCommissionRate(report?.rate ?? 0.01)} del total de ventas en POS y
        pedidos entregados (sin garantías). Quincenas: del 1 al 15 y del 16 al fin
        de mes.
      </p>

      <div className={styles.toolbar}>
        <div className={styles.chips} role="tablist">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={filter === f.id}
              className={`${styles.chip} ${filter === f.id ? styles.chipActive : ""}`}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <button
            type="button"
            className={`${ui.btn} ${ui.btnGhost}`}
            onClick={() => void load()}
          >
            Actualizar
          </button>
          <button
            type="button"
            className={`${ui.btn} ${ui.btnPrimary}`}
            disabled={!report}
            onClick={() => report && downloadCommissionCsv(report)}
          >
            Exportar CSV
          </button>
        </div>
      </div>

      {report && (
        <p className={styles.rateNote}>
          Periodo: <strong>{report.quincenaLabel}</strong>
          {report.quincenaKey === currentKey && filter === "current" ? (
            <span className={styles.muted}> · en curso</span>
          ) : null}
        </p>
      )}

      {error ? (
        <div className={styles.errorBox} role="alert">
          {error}
        </div>
      ) : null}

      {loading && !report && !error ? (
        <p className={styles.muted}>Calculando comisiones…</p>
      ) : null}

      {report && report.rows.length === 0 ? (
        <div className={ui.card}>
          <p className={styles.muted} style={{ margin: 0 }}>
            No hay ventas con comisión en esta quincena. Registra vendedoras en{" "}
            <Link to="/ajustes">Ajustes</Link> y elige nombre al cobrar en el POS.
          </p>
        </div>
      ) : null}

      {report && report.rows.length > 0 ? (
        <div className={ui.card}>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Vendedora</th>
                  <th className={styles.num}>Ventas</th>
                  <th className={styles.num}>Total vendido</th>
                  <th className={styles.num}>Comisión (1%)</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {report.rows.map((row) => (
                  <Fragment key={row.seller}>
                    <tr>
                      <td>{row.seller}</td>
                      <td className={styles.num}>{row.salesCount}</td>
                      <td className={styles.num}>{formatMoney(row.salesTotal)}</td>
                      <td className={`${styles.num} ${styles.gold}`}>
                        {formatMoney(row.commission)}
                      </td>
                      <td className={styles.num}>
                        {row.sales.length > 0 ? (
                          <button
                            type="button"
                            className={`${ui.btn} ${ui.btnGhost}`}
                            style={{ fontSize: "0.75rem", padding: "0.25rem 0.5rem" }}
                            onClick={() =>
                              setExpanded((e) =>
                                e === row.seller ? null : row.seller
                              )
                            }
                          >
                            {expanded === row.seller ? "Ocultar" : "Detalle"}
                          </button>
                        ) : null}
                      </td>
                    </tr>
                    {expanded === row.seller && row.sales.length > 0 ? (
                      <tr>
                        <td colSpan={5}>
                          <div className={styles.detailBlock}>
                            <h3 className={styles.detailTitle}>
                              Tickets — {row.seller}
                            </h3>
                            <ul className={styles.detailList}>
                              {row.sales.slice(0, 40).map((s) => (
                                <li key={s.id}>
                                  <span>
                                    <time dateTime={s.at}>
                                      {formatDate(s.at)}
                                    </time>
                                    {" · "}
                                    {s.payment}
                                  </span>
                                  <span>
                                    {formatMoney(s.total)} →{" "}
                                    {formatMoney(s.commission)}
                                  </span>
                                </li>
                              ))}
                            </ul>
                            {row.sales.length > 40 ? (
                              <p className={styles.muted}>
                                +{row.sales.length - 40} más en el CSV
                              </p>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                ))}
                <tr className={styles.totalRow}>
                  <td>Total</td>
                  <td className={styles.num}>{report.totals.salesCount}</td>
                  <td className={styles.num}>
                    {formatMoney(report.totals.salesTotal)}
                  </td>
                  <td className={`${styles.num} ${styles.gold}`}>
                    {formatMoney(report.totals.commission)}
                  </td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
