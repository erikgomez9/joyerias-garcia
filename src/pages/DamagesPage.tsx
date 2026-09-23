import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { DamageReportDialog } from "@/components/DamageReportDialog";
import { ProductThumb } from "@/components/ProductThumb";
import { StockBadge } from "@/components/StockBadge";
import { usePos } from "@/context/PosContext";
import { damagesApi } from "@/lib/api";
import { downloadDamagesCsv } from "@/lib/exportDamages";
import { formatDate } from "@/lib/format";
import { findProductByScan } from "@/lib/posScan";
import { PRODUCT_STATUS_LABELS } from "@/lib/stockDisplay";
import type { DamageRecord, Product } from "@/types";
import ui from "@/components/ui.module.css";
import styles from "./Pages.module.css";

function damageBlockReason(product: Product): string | null {
  if (product.status === "reservado") {
    return `«${product.name}» está en un pedido. Libérala en Pedidos antes de reportar daño.`;
  }
  if (product.stock <= 0) {
    return `«${product.name}» no tiene stock para reportar.`;
  }
  return null;
}

export function DamagesPage() {
  const { products, inventorySource, refreshProductsQuiet } = usePos();
  const [history, setHistory] = useState<DamageRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [historyError, setHistoryError] = useState("");
  const [q, setQ] = useState("");
  const [scanMsg, setScanMsg] = useState("");
  const [confirmProduct, setConfirmProduct] = useState<Product | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const loadHistory = useCallback(async () => {
    if (inventorySource !== "mongo") {
      setHistory([]);
      setLoadingHistory(false);
      setHistoryError(
        "Conecta MongoDB para registrar daños y ver el historial."
      );
      return;
    }
    setLoadingHistory(true);
    setHistoryError("");
    try {
      const rows = await damagesApi.list();
      setHistory(rows);
    } catch (err) {
      setHistoryError(
        err instanceof Error ? err.message : "No se pudo cargar el historial."
      );
    } finally {
      setLoadingHistory(false);
    }
  }, [inventorySource]);

  useEffect(() => {
    void refreshProductsQuiet();
  }, [refreshProductsQuiet]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  function resolveProduct(p: Product): Product {
    return products.find((x) => x.id === p.id) ?? p;
  }

  function openConfirm(product: Product) {
    const fresh = resolveProduct(product);
    const block = damageBlockReason(fresh);
    if (block) {
      setScanMsg(block);
      return;
    }
    setScanMsg("");
    setConfirmProduct(fresh);
  }

  function tryScan(code: string) {
    const hit = findProductByScan(products, code);
    if (!hit) {
      setScanMsg("Código no encontrado.");
      return;
    }
    openConfirm(hit);
    setQ("");
  }

  function onSearchKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const term = q.trim();
    if (!term) return;
    tryScan(term);
  }

  async function submitDamage(payload: {
    qty: number;
    reason: string;
    notes: string;
  }) {
    if (!confirmProduct) return;
    setSubmitting(true);
    setScanMsg("");
    try {
      await damagesApi.report({
        productId: confirmProduct.id,
        qty: payload.qty,
        reason: payload.reason,
        notes: payload.notes || undefined,
      });
      setConfirmProduct(null);
      setScanMsg(
        `Daño registrado: ${payload.qty} pieza(s) de ${confirmProduct.name}. Stock actualizado.`
      );
      await refreshProductsQuiet();
      await loadHistory();
      searchRef.current?.focus();
    } catch (err) {
      setScanMsg(
        err instanceof Error ? err.message : "No se pudo registrar el daño."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.salesPage}>
      <header className={styles.salesHeader}>
        <div>
          <h1 className={ui.pageTitle}>Daños</h1>
          <p className={`${ui.pageDesc} ${styles.salesDesc}`}>
            Reporta joyas dañadas o cambiadas en garantía. El stock baja igual
            que en una salida; el historial queda aquí para control.
          </p>
        </div>
        <button
          type="button"
          className={`${ui.btn} ${ui.btnGhost} ${styles.salesExportBtn}`}
          disabled={history.length === 0}
          onClick={() => downloadDamagesCsv(history)}
        >
          Exportar CSV
        </button>
      </header>

      <div className={ui.card} style={{ marginBottom: "1.25rem" }}>
        <label className={styles.catalogFiltersLabel}>
          Escanear o buscar SKU / código de barras
          <input
            ref={searchRef}
            className={ui.input}
            autoComplete="off"
            placeholder="Enfoca aquí y escanea…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onSearchKeyDown}
            disabled={inventorySource !== "mongo"}
          />
        </label>
        {scanMsg ? (
          <p
            className={styles.catalogFilterHint}
            style={{
              marginTop: "0.65rem",
              color: scanMsg.includes("registrado")
                ? "var(--ok)"
                : "var(--danger)",
            }}
          >
            {scanMsg}
          </p>
        ) : null}
        {inventorySource !== "mongo" ? (
          <p className={styles.catalogFilterHint} style={{ marginTop: "0.5rem" }}>
            Activa la API con MongoDB para usar esta pantalla.
          </p>
        ) : null}
      </div>

      <h2 className={styles.sectionTitle}>Historial reciente</h2>
      {loadingHistory ? (
        <p className={styles.catalogFilterHint}>Cargando…</p>
      ) : historyError ? (
        <div className={ui.card}>
          <p style={{ margin: 0, color: "var(--text-muted)" }}>{historyError}</p>
        </div>
      ) : history.length === 0 ? (
        <div className={ui.card}>
          <p style={{ margin: 0, color: "var(--text-muted)" }}>
            Aún no hay daños registrados. Escanea una joya arriba para la
            primera entrada.
          </p>
        </div>
      ) : (
        <div className={ui.tableWrap}>
          <table className={ui.table}>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Joyas</th>
                <th>Cant.</th>
                <th>Motivo</th>
                <th>Stock después</th>
              </tr>
            </thead>
            <tbody>
              {history.map((d) => {
                const product = products.find((p) => p.id === d.productId);
                return (
                  <tr key={d.id}>
                    <td>{formatDate(d.at)}</td>
                    <td>
                      <div style={{ display: "flex", gap: "0.65rem", alignItems: "flex-start" }}>
                        {product?.image ? (
                          <ProductThumb
                            src={product.image}
                            alt={product.name}
                            size="sm"
                          />
                        ) : null}
                        <div>
                          <div>{d.name}</div>
                          <div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
                            SKU {d.sku}
                          </div>
                          {product ? (
                            <div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
                              {PRODUCT_STATUS_LABELS[product.status]}
                              {" · "}
                              <StockBadge
                                stock={product.stock}
                                status={product.status}
                                emphasize={false}
                              />
                            </div>
                          ) : null}
                          {d.notes ? (
                            <div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
                              {d.notes}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td>{d.qty}</td>
                    <td>{d.reason}</td>
                    <td>{d.stockAfter ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {confirmProduct ? (
        <DamageReportDialog
          product={confirmProduct}
          submitting={submitting}
          onClose={() => !submitting && setConfirmProduct(null)}
          onConfirm={(payload) => void submitDamage(payload)}
        />
      ) : null}
    </div>
  );
}
