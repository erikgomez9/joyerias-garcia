import { Link } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePos } from "@/context/PosContext";
import { downloadSalesCsv } from "@/lib/exportSales";
import { formatMoney, formatDate } from "@/lib/format";
import {
  findProductForSaleLine,
  resolveSaleLineMaterial,
  resolveSaleLineUnitCost,
} from "@/lib/saleLineDetails";
import { formatPaymentMix } from "@/lib/paymentMix";
import {
  filterSalesByPeriod,
  SALES_PERIOD_LABELS,
  type SalesPeriod,
} from "@/lib/saleDateFilter";
import { priceTierLabel, resolveSalePriceTier } from "@/lib/salePricing";
import {
  isOrderSale,
  isSaleFromOrder,
  resolveOrderCode,
  salePaymentLabel,
} from "@/lib/saleOrigin";
import {
  isWarrantyAdjustmentSale,
  originalSaleCaption,
  resolveOriginalSale,
  saleNetTotal,
  warrantySaleHeadline,
} from "@/lib/warrantyLabels";
import type { OrderRecord, SaleRecord } from "@/types";
import ui from "@/components/ui.module.css";
import styles from "./Pages.module.css";

const PERIODS: SalesPeriod[] = ["today", "week", "month", "all"];

function paymentDetail(s: SaleRecord, orders: OrderRecord[]): string | null {
  if (isOrderSale(s, orders)) return null;
  if (s.payment === "mixto" && s.paymentMix) {
    return formatPaymentMix(s.paymentMix);
  }
  return null;
}

function pieceCount(s: SaleRecord): number {
  return s.items.reduce((a, i) => a + i.qty, 0);
}

function itemsPreview(s: SaleRecord): string {
  if (s.items.length === 0) return "Sin artículos";
  const first = s.items[0]!.name;
  if (s.items.length === 1) return first;
  return `${first} (+${s.items.length - 1} más)`;
}

function lineCount(s: SaleRecord): number {
  return s.items.length;
}

function saleDetailSummary(
  s: SaleRecord,
  orders: OrderRecord[]
): { pieces: string; lines: string; pay: string | null; orderCode: string | null } {
  const n = lineCount(s);
  const pieces = pieceCount(s);
  const pay = isOrderSale(s, orders)
    ? null
    : s.payment === "mixto" && s.paymentMix
      ? formatPaymentMix(s.paymentMix)
      : salePaymentLabel(s, orders);
  const orderCode = isSaleFromOrder(s, orders)
    ? resolveOrderCode(s, orders) ?? null
    : null;
  return {
    lines: `${n} línea${n === 1 ? "" : "s"}`,
    pieces: `${pieces} pieza${pieces === 1 ? "" : "s"}`,
    pay,
    orderCode,
  };
}

export function SalesPage() {
  const { sales, orders, products, inventorySource } = usePos();
  const [period, setPeriod] = useState<SalesPeriod>("month");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());
  const [pendingScrollSaleId, setPendingScrollSaleId] = useState<string | null>(
    null
  );
  const saleCardRefs = useRef<Record<string, HTMLLIElement | null>>({});

  function expandAndScrollSale(id: string) {
    setExpandedIds((prev) => new Set(prev).add(id));
    window.setTimeout(() => {
      saleCardRefs.current[id]?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 80);
  }

  function goToOriginalSale(originalId: string) {
    if (!sales.some((s) => s.id === originalId)) return;
    const visible = filterSalesByPeriod(sales, period).some(
      (s) => s.id === originalId
    );
    if (!visible) {
      setPendingScrollSaleId(originalId);
      setPeriod("all");
      return;
    }
    expandAndScrollSale(originalId);
  }

  function toggleSaleDetail(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const filtered = useMemo(
    () => filterSalesByPeriod(sales, period),
    [sales, period]
  );

  useEffect(() => {
    if (!pendingScrollSaleId) return;
    const visible = filtered.some((s) => s.id === pendingScrollSaleId);
    if (visible) {
      expandAndScrollSale(pendingScrollSaleId);
      setPendingScrollSaleId(null);
    }
  }, [filtered, pendingScrollSaleId]);

  const byPayment = useMemo(() => {
    const m: Record<string, number> = {};
    for (const s of filtered) {
      const key =
        s.payment === "mixto" && s.paymentMix && !isOrderSale(s, orders)
          ? formatPaymentMix(s.paymentMix)
          : salePaymentLabel(s, orders);
      m[key] = (m[key] ?? 0) + saleNetTotal(s);
    }
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [filtered, orders]);

  const totalPeriodo = filtered.reduce((a, s) => a + saleNetTotal(s), 0);
  const ticketPromedio =
    filtered.length > 0 ? totalPeriodo / filtered.length : 0;
  const maxPay = byPayment[0]?.[1] ?? 1;

  const sourceHint =
    inventorySource === "mongo"
      ? "Historial desde la base de datos."
      : inventorySource === "local"
        ? "Historial local en este equipo."
        : "Cargando…";

  return (
    <div className={styles.salesPage}>
      <header className={styles.salesHeader}>
        <div>
          <h1 className={ui.pageTitle}>Ventas</h1>
          <p className={`${ui.pageDesc} ${styles.salesDesc}`}>
            {sourceHint} Periodo:{" "}
            <strong>{SALES_PERIOD_LABELS[period].toLowerCase()}</strong>.
          </p>
        </div>
        <button
          type="button"
          className={`${ui.btn} ${ui.btnGhost} ${styles.salesExportBtn}`}
          disabled={filtered.length === 0}
          onClick={() =>
            downloadSalesCsv(
              filtered,
              `ventas-${period}-${new Date().toISOString().slice(0, 10)}.csv`,
              orders
            )
          }
        >
          Exportar CSV
        </button>
      </header>

      <div className={styles.salesPeriodBar}>
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
      </div>

      <div className={styles.salesKpiGrid}>
        <div className={ui.card}>
          <div className={ui.cardMuted}>Tickets</div>
          <div className={ui.cardValue}>{filtered.length}</div>
        </div>
        <div className={`${ui.card} ${styles.salesKpiHighlight}`}>
          <div className={ui.cardMuted}>Ingreso neto (caja)</div>
          <div className={styles.salesKpiGold}>{formatMoney(totalPeriodo)}</div>
        </div>
        <div className={ui.card}>
          <div className={ui.cardMuted}>Ticket promedio</div>
          <div className={ui.cardValue}>{formatMoney(ticketPromedio)}</div>
        </div>
      </div>
      <p className={styles.salesCajaHint}>
        Incluye ventas POS y pedidos. Los tickets de garantía suman solo el extra
        o restan reembolsos; cambios a $0 no mueven la caja. Abajo cada ticket
        muestra su etiqueta y monto (+, − o $0).
      </p>

      {filtered.length === 0 ? (
        <div className={styles.salesEmpty}>
          <p>No hay ventas en este periodo.</p>
          <Link to="/pos" className={`${ui.btn} ${ui.btnPrimary}`}>
            Ir al punto de venta
          </Link>
        </div>
      ) : (
        <div className={styles.salesBody}>
          <section className={styles.salesPayPanel} aria-labelledby="sales-pay-title">
            <h2 id="sales-pay-title" className={styles.salesPanelTitle}>
              Formas de pago
            </h2>
            <ul className={styles.salesPayList}>
              {byPayment.map(([label, amount]) => (
                <li key={label} className={styles.salesPayRow}>
                  <div className={styles.salesPayRowHead}>
                    <span className={styles.salesPayLabel}>{label}</span>
                    <span className={styles.salesPayAmount}>
                      {formatMoney(amount)}
                    </span>
                  </div>
                  <div className={styles.salesPayTrack} aria-hidden>
                    <div
                      className={styles.salesPayFill}
                      style={{ width: `${(amount / maxPay) * 100}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className={styles.salesListPanel} aria-labelledby="sales-list-title">
            <h2 id="sales-list-title" className={styles.salesPanelTitle}>
              Detalle de tickets
            </h2>
            <ul className={styles.salesList}>
              {filtered.map((s) => {
                const detail = paymentDetail(s, orders);
                const expanded = expandedIds.has(s.id);
                const originalSale = isWarrantyAdjustmentSale(s)
                  ? resolveOriginalSale(s, sales)
                  : undefined;
                const priceTier = resolveSalePriceTier(s, products);
                return (
                  <li
                    key={s.id}
                    id={`sale-${s.id}`}
                    ref={(el) => {
                      saleCardRefs.current[s.id] = el;
                    }}
                    className={styles.saleCard}
                  >
                    <div className={styles.saleCardTop}>
                      <time className={styles.saleCardDate} dateTime={s.at}>
                        {formatDate(s.at)}
                      </time>
                      <span className={styles.saleCardTotal}>
                        {formatMoney(saleNetTotal(s))}
                      </span>
                    </div>
                    <div className={styles.saleCardMeta}>
                      {isWarrantyAdjustmentSale(s) ? (
                        <span
                          className={`${styles.saleOriginBadge} ${styles.saleOriginPedido}`}
                          title={warrantySaleHeadline(s) ?? "Garantía"}
                        >
                          {warrantySaleHeadline(s)}
                        </span>
                      ) : isSaleFromOrder(s, orders) ? (
                        <Link
                          to="/pedidos"
                          className={`${styles.saleOriginBadge} ${styles.saleOriginPedido}`}
                          title="Venta generada al entregar un pedido"
                        >
                          Pedido {resolveOrderCode(s, orders) ?? "—"}
                        </Link>
                      ) : (
                        <span
                          className={`${styles.saleOriginBadge} ${styles.saleOriginPos}`}
                        >
                          Punto de venta
                        </span>
                      )}
                      {!isOrderSale(s, orders) && (
                        <span className={ui.badge}>
                          {salePaymentLabel(s, orders)}
                        </span>
                      )}
                      {priceTier && (
                        <span className={ui.badge} title="Lista de precios del ticket">
                          {priceTierLabel(priceTier)}
                        </span>
                      )}
                      <span className={styles.saleCardPieces}>
                        {pieceCount(s)} pieza{pieceCount(s) === 1 ? "" : "s"}
                      </span>
                    </div>
                    {!expanded && (
                      <>
                        <p className={styles.saleCardPreview}>
                          {itemsPreview(s)}
                        </p>
                        {originalSale ? (
                          <button
                            type="button"
                            className={styles.saleOriginalLink}
                            onClick={() => goToOriginalSale(originalSale.id)}
                          >
                            Venta original:{" "}
                            {originalSaleCaption(originalSale, orders)}
                          </button>
                        ) : isWarrantyAdjustmentSale(s) && s.originalSaleId ? (
                          <p className={styles.saleOriginalMissing}>
                            Venta original no encontrada en el historial.
                          </p>
                        ) : null}
                      </>
                    )}
                    <div className={styles.saleCardActions}>
                      {!isWarrantyAdjustmentSale(s) && (
                        <Link
                          to={`/garantias?saleId=${encodeURIComponent(s.id)}`}
                          className={`${ui.btn} ${ui.btnGhost} ${styles.saleDetailBtn}`}
                        >
                          Garantía / cambio
                        </Link>
                      )}
                      <button
                        type="button"
                        className={`${ui.btn} ${ui.btnGhost} ${styles.saleDetailBtn}`}
                        aria-expanded={expanded}
                        onClick={() => toggleSaleDetail(s.id)}
                      >
                        {expanded ? "Ocultar detalle" : "Ver detalle"}
                      </button>
                    </div>
                    {expanded && (
                      <div className={styles.saleCardExpanded}>
                        {(() => {
                          const sum = saleDetailSummary(s, orders);
                          return (
                            <>
                              {originalSale ? (
                                <div className={styles.saleWarrantyOriginal}>
                                  <span className={styles.saleWarrantyOriginalLabel}>
                                    Venta original del cliente
                                  </span>
                                  <button
                                    type="button"
                                    className={styles.saleOriginalLink}
                                    onClick={() =>
                                      goToOriginalSale(originalSale.id)
                                    }
                                  >
                                    {originalSaleCaption(originalSale, orders)}
                                  </button>
                                  <span className={styles.saleWarrantyOriginalHint}>
                                    Clic para ir al ticket y ver líneas.
                                  </span>
                                </div>
                              ) : null}
                              <div className={styles.saleDetailSummary}>
                                <span>
                                  {sum.lines} · {sum.pieces}
                                  {priceTier
                                    ? ` · ${priceTierLabel(priceTier)}`
                                    : ""}
                                </span>
                                {sum.pay && (
                                  <>
                                    <span
                                      className={styles.saleDetailDot}
                                      aria-hidden
                                    >
                                      ·
                                    </span>
                                    <span>{sum.pay}</span>
                                  </>
                                )}
                                {sum.orderCode && (
                                  <>
                                    <span
                                      className={styles.saleDetailDot}
                                      aria-hidden
                                    >
                                      ·
                                    </span>
                                    <Link
                                      to="/pedidos"
                                      className={styles.saleDetailOrderCode}
                                      title="Ver pedidos"
                                    >
                                      {sum.orderCode}
                                    </Link>
                                  </>
                                )}
                                {!sum.orderCode && !isSaleFromOrder(s, orders) && (
                                  <>
                                    <span
                                      className={styles.saleDetailDot}
                                      aria-hidden
                                    >
                                      ·
                                    </span>
                                    <span className={styles.saleDetailPos}>
                                      Punto de venta
                                    </span>
                                  </>
                                )}
                              </div>
                              {detail && (
                                <p className={styles.saleCardPayDetail}>
                                  {detail}
                                </p>
                              )}
                              <ul className={styles.saleCardItems}>
                                {s.items.map((item, i) => {
                                  const catalog = findProductForSaleLine(
                                    item,
                                    products
                                  );
                                  const material = resolveSaleLineMaterial(
                                    item,
                                    catalog
                                  );
                                  const unitCost = resolveSaleLineUnitCost(
                                    item,
                                    catalog
                                  );
                                  return (
                                  <li
                                    key={`${item.name}-${i}`}
                                    className={styles.saleDetailLine}
                                  >
                                    <div className={styles.saleDetailLineMain}>
                                      <span className={styles.saleDetailName}>
                                        {item.name}
                                      </span>
                                      {(material || unitCost != null) && (
                                        <span className={styles.saleDetailSku}>
                                          {[
                                            material && `Material: ${material}`,
                                            unitCost != null &&
                                              `Costo: ${formatMoney(unitCost)}`,
                                          ]
                                            .filter(Boolean)
                                            .join(" · ")}
                                        </span>
                                      )}
                                      {item.sku?.trim() && (
                                        <span className={styles.saleDetailSku}>
                                          SKU {item.sku.trim()}
                                        </span>
                                      )}
                                      {!isWarrantyAdjustmentSale(s) && (
                                        <Link
                                          to={`/garantias?saleId=${encodeURIComponent(s.id)}&line=${i}`}
                                          className={styles.saleDetailSku}
                                          style={{ display: "block" }}
                                        >
                                          Reportar garantía de esta línea
                                        </Link>
                                      )}
                                    </div>
                                    <div className={styles.saleDetailLineAmt}>
                                      <span className={styles.saleDetailQty}>
                                        ×{item.qty}
                                      </span>
                                      <span className={styles.saleDetailSubtotal}>
                                        {formatMoney(
                                          item.unitPrice * item.qty
                                        )}
                                      </span>
                                    </div>
                                  </li>
                                );
                                })}
                              </ul>
                              <div className={styles.saleDetailFoot}>
                                <span>
                                  {isWarrantyAdjustmentSale(s)
                                    ? "Efecto en caja"
                                    : "Total del ticket"}
                                </span>
                                <strong>{formatMoney(saleNetTotal(s))}</strong>
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        </div>
      )}
    </div>
  );
}
