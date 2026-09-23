import { useCallback, useEffect, useState } from "react";
import { isMongoApiAvailable, reportsApi } from "@/lib/api";
import { downloadLiveReportCsv } from "@/lib/exportSalesReport";
import { formatDate, formatMoney } from "@/lib/format";
import {
  SALES_PERIOD_LABELS,
  type SalesPeriod,
} from "@/lib/saleDateFilter";
import { StockBadge } from "@/components/StockBadge";
import type { LiveSalesReport } from "@/types/reports";
import ui from "@/components/ui.module.css";
import styles from "./SalesReportPage.module.css";

const PERIODS: SalesPeriod[] = ["today", "week", "month", "all"];
const REFRESH_MS = 12_000;

export function SalesReportPage() {
  const [period, setPeriod] = useState<SalesPeriod>("month");
  const [report, setReport] = useState<LiveSalesReport | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [live, setLive] = useState(true);
  const [mongo, setMongo] = useState<boolean | null>(null);

  const load = useCallback(async () => {
    try {
      const ok = await isMongoApiAvailable();
      setMongo(ok);
      if (!ok) {
        setError("Conecta la API y MongoDB para ver reportes en vivo.");
        setReport(null);
        return;
      }
      const data = await reportsApi.live(period);
      setReport(data);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar el reporte.");
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  useEffect(() => {
    if (!live || mongo === false) return;
    const id = window.setInterval(() => void load(), REFRESH_MS);
    return () => window.clearInterval(id);
  }, [live, mongo, load]);

  const maxStar =
    report?.starProducts[0]?.revenue ?? 1;

  return (
    <div className={styles.page}>
      <div className={styles.toolbar}>
        <div className={styles.chips} role="tablist" aria-label="Periodo">
          {PERIODS.map((p) => (
            <button
              key={p}
              type="button"
              role="tab"
              aria-selected={period === p}
              className={`${styles.chip} ${period === p ? styles.chipActive : ""}`}
              onClick={() => setPeriod(p)}
            >
              {SALES_PERIOD_LABELS[p]}
            </button>
          ))}
        </div>
        <div className={styles.toolbarActions}>
          <label className={styles.liveToggle}>
            <input
              type="checkbox"
              checked={live}
              onChange={(e) => setLive(e.target.checked)}
            />
            Actualización automática
          </label>
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
            onClick={() => report && downloadLiveReportCsv(report, period)}
          >
            Exportar CSV
          </button>
        </div>
      </div>

      {report && (
        <p className={styles.updated}>
          Datos al{" "}
          <time dateTime={report.generatedAt}>
            {formatDate(report.generatedAt)}
          </time>
          {live && (
            <span className={styles.liveDot} title="En vivo">
              {" "}
              · en vivo
            </span>
          )}
        </p>
      )}

      {error && (
        <div className={styles.errorBox} role="alert">
          {error}
        </div>
      )}

      {loading && !report && !error && (
        <p className={styles.muted}>Cargando reporte…</p>
      )}

      {report && (
        <>
          <div className={styles.kpiGrid}>
            <div className={ui.card}>
              <div className={ui.cardMuted}>Tickets</div>
              <div className={ui.cardValue}>{report.summary.tickets}</div>
            </div>
            <div className={`${ui.card} ${styles.kpiGold}`}>
              <div className={ui.cardMuted}>Total vendido</div>
              <div className={styles.kpiTotal}>
                {formatMoney(report.summary.total)}
              </div>
            </div>
            <div className={ui.card}>
              <div className={ui.cardMuted}>Ticket promedio</div>
              <div className={ui.cardValue}>
                {formatMoney(report.summary.avgTicket)}
              </div>
            </div>
            <div className={ui.card}>
              <div className={ui.cardMuted}>Piezas vendidas</div>
              <div className={ui.cardValue}>{report.summary.pieces}</div>
            </div>
          </div>

          <div className={styles.grid}>
            <section className={styles.panel}>
              <h2 className={styles.panelTitle}>Productos estrella</h2>
              <p className={styles.panelDesc}>
                Más vendidos en {SALES_PERIOD_LABELS[period].toLowerCase()}.
              </p>
              {report.starProducts.length === 0 ? (
                <p className={styles.muted}>Sin ventas con piezas en este periodo.</p>
              ) : (
                <ul className={styles.starList}>
                  {report.starProducts.slice(0, 12).map((p) => (
                    <li key={`${p.sku}-${p.name}`} className={styles.starRow}>
                      <div className={styles.starHead}>
                        <span className={styles.starName}>{p.name}</span>
                        <span className={styles.starSku}>SKU {p.sku}</span>
                      </div>
                      <div className={styles.starMeta}>
                        <span>{p.qty} pzs</span>
                        <span className={styles.starRev}>
                          {formatMoney(p.revenue)}
                        </span>
                      </div>
                      <div className={styles.starTrack} aria-hidden>
                        <div
                          className={styles.starFill}
                          style={{
                            width: `${(p.revenue / maxStar) * 100}%`,
                          }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section
              className={`${styles.panel} ${report.outOfStock.length > 0 ? styles.panelAlert : ""}`}
            >
              <h2 className={styles.panelTitle}>
                Agotados / sin stock
                {report.outOfStock.length > 0 && (
                  <span className={styles.countBadge}>
                    {report.outOfStock.length}
                  </span>
                )}
              </h2>
              <p className={styles.panelDesc}>
                Piezas con existencia en cero — no se venden en mostrador.
              </p>
              {report.outOfStock.length === 0 ? (
                <p className={styles.muted}>Ninguna pieza agotada ahora.</p>
              ) : (
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Pieza</th>
                        <th>SKU</th>
                        <th>Existencia</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.outOfStock.slice(0, 40).map((p) => (
                        <tr key={p.id} className={styles.rowOut}>
                          <td>
                            <span className={styles.outName}>{p.name}</span>
                          </td>
                          <td>{p.sku}</td>
                          <td>
                            <StockBadge stock={p.stock} status={p.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {report.outOfStock.length > 40 && (
                    <p className={styles.muted}>
                      +{report.outOfStock.length - 40} más en CSV
                    </p>
                  )}
                </div>
              )}
            </section>

            <section className={styles.panel}>
              <h2 className={styles.panelTitle}>Stock bajo (≤ 3)</h2>
              {report.lowStock.length === 0 ? (
                <p className={styles.muted}>Sin alertas de stock bajo.</p>
              ) : (
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Pieza</th>
                        <th>SKU</th>
                        <th>Quedan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.lowStock.slice(0, 30).map((p) => (
                        <tr key={p.id}>
                          <td>{p.name}</td>
                          <td>{p.sku}</td>
                          <td>
                            <StockBadge stock={p.stock} status={p.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className={styles.panel}>
              <h2 className={styles.panelTitle}>Ventas recientes</h2>
              <ul className={styles.recentList}>
                {report.recentSales.map((s) => (
                  <li key={s.id} className={styles.recentRow}>
                    <time dateTime={s.at}>{formatDate(s.at)}</time>
                    <span className={styles.recentTotal}>
                      {formatMoney(s.total)}
                    </span>
                    <span className={styles.recentMeta}>
                      {s.pieces} pzs
                      {s.orderCode ? ` · ${s.orderCode}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
