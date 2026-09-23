import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { Link, useSearchParams } from "react-router-dom";
import { usePos } from "@/context/PosContext";
import { warrantiesApi } from "@/lib/api";
import {
  formatDate,
  formatMoney,
  productPrice,
  type PriceTier,
} from "@/lib/format";
import { findProductByScan } from "@/lib/posScan";
import { isProductSellableAtPos } from "@/lib/productAvailability";
import {
  paymentMixTotal,
  validatePaymentMix,
} from "@/lib/paymentMix";
import {
  computeWarrantyExchangeBreakdown,
  isSameValueExchangeAtTier,
  suggestPriceTierForPaidUnit,
} from "@/lib/warrantyPricing";
import { remainingWarrantyQty } from "@/lib/warrantyLineQty";
import {
  isWarrantyAdjustmentSale,
  WARRANTY_TYPE_LABELS,
} from "@/lib/warrantyLabels";
import type {
  PaymentMix,
  Product,
  SalePaymentMethod,
  SaleRecord,
  WarrantyCaseRecord,
  WarrantyType,
} from "@/types";
import ui from "@/components/ui.module.css";
import styles from "./Pages.module.css";

const TYPES: WarrantyType[] = ["same_value", "price_difference", "refund"];
const PAYMENTS: SalePaymentMethod[] = [
  "efectivo",
  "tarjeta",
  "transferencia",
  "mixto",
];

function lineLabel(s: SaleRecord, index: number): string {
  const item = s.items[index];
  if (!item) return `Línea ${index + 1}`;
  return `${item.name} · SKU ${item.sku ?? "—"} × ${item.qty} · ${formatMoney(item.unitPrice)}`;
}

export function WarrantyPage() {
  const { sales, products, inventorySource, refreshProductsQuiet, refreshSalesQuiet } =
    usePos();
  const [searchParams, setSearchParams] = useSearchParams();
  const openedFromSales = searchParams.has("saleId");
  const [history, setHistory] = useState<WarrantyCaseRecord[]>([]);
  const [saleQ, setSaleQ] = useState("");
  const [selectedSale, setSelectedSale] = useState<SaleRecord | null>(null);
  const [lineIndex, setLineIndex] = useState(0);
  const [returnQty, setReturnQty] = useState(1);
  const [warrantyType, setWarrantyType] = useState<WarrantyType>("same_value");
  const [replacement, setReplacement] = useState<Product | null>(null);
  const [replaceQ, setReplaceQ] = useState("");
  const [tier, setTier] = useState<PriceTier>("menudeo");
  const [chargedOverride, setChargedOverride] = useState<string>("");
  const [chargeManuallyEdited, setChargeManuallyEdited] = useState(false);
  const [refundOverride, setRefundOverride] = useState<string>("");
  const [payment, setPayment] = useState<SalePaymentMethod>("efectivo");
  const [mix, setMix] = useState<PaymentMix>({});
  const [notes, setNotes] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const replaceRef = useRef<HTMLInputElement>(null);

  const loadHistory = useCallback(async () => {
    if (inventorySource !== "mongo") return;
    try {
      const rows = await warrantiesApi.list();
      setHistory(rows);
    } catch {
      /* ignore */
    }
  }, [inventorySource]);

  useEffect(() => {
    void refreshProductsQuiet();
    void refreshSalesQuiet();
    void loadHistory();
  }, [refreshProductsQuiet, refreshSalesQuiet, loadHistory]);

  useEffect(() => {
    const saleId = searchParams.get("saleId");
    const line = searchParams.get("line");
    if (!saleId) return;
    const hit = sales.find((s) => s.id === saleId);
    if (hit) {
      setSelectedSale(hit);
      if (line != null) setLineIndex(Math.max(0, parseInt(line, 10) || 0));
    }
  }, [searchParams, sales]);

  const filteredSales = useMemo(() => {
    const term = saleQ.trim().toLowerCase();
    const base = [...sales]
      .filter((s) => !isWarrantyAdjustmentSale(s))
      .sort(
        (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()
      );
    if (!term) return base.slice(0, 40);
    return base.filter((s) => {
      const hay = [
        formatDate(s.at),
        s.orderCode ?? "",
        ...s.items.map((i) => `${i.name} ${i.sku ?? ""}`),
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(term);
    }).slice(0, 40);
  }, [sales, saleQ]);

  const selectedLine = selectedSale?.items[lineIndex];

  const lineSoldQty = selectedLine?.qty ?? 1;

  const remainingQty = useMemo(() => {
    if (!selectedSale || !selectedLine) return lineSoldQty;
    return remainingWarrantyQty(
      history,
      selectedSale.id,
      lineIndex,
      lineSoldQty,
      {
        sku: selectedLine.sku,
        unitPrice: selectedLine.unitPrice,
      }
    );
  }, [history, selectedSale, selectedLine, lineIndex, lineSoldQty]);

  useEffect(() => {
    setReturnQty(1);
  }, [selectedSale?.id, lineIndex]);

  useEffect(() => {
    if (returnQty > remainingQty) {
      setReturnQty(Math.max(1, remainingQty));
    }
  }, [remainingQty, returnQty]);

  const credit = useMemo(() => {
    if (!selectedLine) return 0;
    return selectedLine.unitPrice * returnQty;
  }, [selectedLine, returnQty]);

  const exchangeBreakdown = useMemo(() => {
    if (!selectedLine || !replacement) return null;
    return computeWarrantyExchangeBreakdown(
      selectedLine.unitPrice,
      returnQty,
      replacement,
      returnQty,
      tier
    );
  }, [selectedLine, replacement, returnQty, tier]);

  const suggestedCharge = useMemo(() => {
    if (warrantyType !== "price_difference" || !exchangeBreakdown) return 0;
    return exchangeBreakdown.extraDue;
  }, [warrantyType, exchangeBreakdown]);

  useEffect(() => {
    setChargeManuallyEdited(false);
    setChargedOverride("");
  }, [replacement?.id, tier, returnQty, lineIndex, selectedSale?.id]);

  useEffect(() => {
    if (
      warrantyType === "price_difference" &&
      exchangeBreakdown &&
      exchangeBreakdown.extraDue > 0 &&
      !chargeManuallyEdited
    ) {
      setChargedOverride(String(exchangeBreakdown.extraDue));
    }
  }, [
    warrantyType,
    exchangeBreakdown,
    chargeManuallyEdited,
  ]);

  const chargedAmount = useMemo(() => {
    if (warrantyType === "same_value") return 0;
    if (warrantyType === "refund") return 0;
    if (chargedOverride.trim() !== "") {
      const n = Number(chargedOverride);
      return Number.isFinite(n) ? Math.max(0, n) : suggestedCharge;
    }
    return suggestedCharge;
  }, [warrantyType, chargedOverride, suggestedCharge]);

  const refundAmount = useMemo(() => {
    if (warrantyType !== "refund") return 0;
    if (refundOverride.trim() !== "") {
      const n = Number(refundOverride);
      return Number.isFinite(n) ? Math.max(0, n) : credit;
    }
    return credit;
  }, [warrantyType, refundOverride, credit]);

  const moneyDue =
    warrantyType === "refund" ? refundAmount : chargedAmount;

  function tryReplacementScan(code: string) {
    const hit = findProductByScan(products, code);
    if (!hit) {
      setMsg("Código de reemplazo no encontrado.");
      return;
    }
    if (hit.stock < returnQty) {
      setMsg(
        `${hit.name}: necesitas ${returnQty} en stock (hay ${hit.stock}).`
      );
      return;
    }
    if (!isProductSellableAtPos(hit)) {
      setMsg(`${hit.name} no está disponible en mostrador.`);
      return;
    }
    setReplacement(hit);
    if (selectedLine && warrantyType === "same_value") {
      setTier(suggestPriceTierForPaidUnit(selectedLine.unitPrice, hit));
    }
    setReplaceQ("");
    setMsg("");
  }

  function pickAnotherSale() {
    setSelectedSale(null);
    setReplacement(null);
    setSearchParams({});
    setMsg("");
  }

  function useSameValueFlow(cashBackHint?: number) {
    setWarrantyType("same_value");
    setChargedOverride("");
    setChargeManuallyEdited(false);
    if (cashBackHint != null && cashBackHint > 0) {
      setMsg(
        `Cambio sin cobro. Entrega la joya nueva y devuelve ${formatMoney(cashBackHint)} al cliente (efectivo/tarjeta en caja).`
      );
    } else {
      setMsg("");
    }
  }

  function usePartialRefundFlow(amount: number) {
    setWarrantyType("refund");
    setRefundOverride(String(amount));
    setReplacement(null);
    setChargedOverride("");
    setChargeManuallyEdited(false);
    setMsg("");
  }

  function onReplaceKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const term = replaceQ.trim();
    if (term) tryReplacementScan(term);
  }

  async function submit() {
    if (!selectedSale || !selectedLine) {
      setMsg("Elige la venta y la línea de la joya dañada.");
      return;
    }
    if (inventorySource !== "mongo") {
      setMsg("Conecta MongoDB para registrar garantías.");
      return;
    }
    if (remainingQty < 1) {
      setMsg("Ya no quedan piezas en esta línea para otra garantía.");
      return;
    }
    if (returnQty < 1 || returnQty > remainingQty) {
      setMsg(`Indica entre 1 y ${remainingQty} pieza(s) defectuosa(s).`);
      return;
    }
    if (warrantyType !== "refund" && !replacement) {
      setMsg("Escanea la joya de reemplazo.");
      return;
    }
    if (warrantyType === "same_value" && replacement && selectedLine) {
      if (
        !isSameValueExchangeAtTier(
          selectedLine.unitPrice,
          returnQty,
          replacement,
          returnQty,
          tier
        )
      ) {
        setMsg(
          "La joya nueva no tiene el mismo valor que lo pagado con la lista elegida. Cambia menudeo/mayoreo, elige otra pieza o usa «Cambio con diferencia»."
        );
        return;
      }
    }
    if (warrantyType === "price_difference" && exchangeBreakdown) {
      if (exchangeBreakdown.diff === 0) {
        setMsg(
          "No hay extra que cobrar. Usa «Cambio mismo valor ($0)» o el botón en la cuenta."
        );
        return;
      }
      if (exchangeBreakdown.diff < 0) {
        setMsg(
          "La joya nueva cuesta menos. Usa reembolso parcial (botón en la cuenta) o cambia el tipo de resolución."
        );
        return;
      }
    }
    if (moneyDue > 0 && payment === "mixto") {
      const err = validatePaymentMix(mix, moneyDue);
      if (err) {
        setMsg(err);
        return;
      }
    }

    setBusy(true);
    setMsg("");
    try {
      await warrantiesApi.create({
        type: warrantyType,
        originalSaleId: selectedSale.id,
        originalLineIndex: lineIndex,
        returnQty,
        replacementProductId: replacement?.id,
        replacementQty: returnQty,
        chargedAmount:
          warrantyType === "price_difference" ? chargedAmount : undefined,
        refundAmount: warrantyType === "refund" ? refundAmount : undefined,
        priceTier: tier,
        payment: moneyDue > 0 ? payment : "efectivo",
        paymentMix: payment === "mixto" ? mix : undefined,
        notes: notes.trim() || undefined,
      });
      await refreshProductsQuiet();
      await refreshSalesQuiet();
      await loadHistory();
      setSelectedSale(null);
      setReplacement(null);
      setSearchParams({});
      setNotes("");
      setChargedOverride("");
      setRefundOverride("");
      setMsg("Garantía registrada: inventario y movimiento de caja actualizados.");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "No se pudo completar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.salesPage}>
      <header className={styles.salesHeader}>
        <div>
          <h1 className={ui.pageTitle}>Garantías y cambios</h1>
          <p className={`${ui.pageDesc} ${styles.salesDesc}`}>
            Post-venta: cambio mismo valor, cobro de diferencia o reembolso. La
            pieza dañada baja en inventario y queda ligada a la venta original.
          </p>
        </div>
        <Link to="/danos" className={`${ui.btn} ${ui.btnGhost}`}>
          Solo daño (sin venta)
        </Link>
      </header>

      {msg ? (
        <p
          className={styles.catalogFilterHint}
          style={{
            marginBottom: "1rem",
            color: msg.includes("registrada") ? "var(--ok)" : "var(--danger)",
          }}
        >
          {msg}
        </p>
      ) : null}

      {selectedSale ? (
        <div className={styles.warrantyNavBar}>
          {openedFromSales ? (
            <Link to="/ventas" className={`${ui.btn} ${ui.btnGhost}`}>
              ← Regresar a ventas
            </Link>
          ) : (
            <Link to="/ventas" className={`${ui.btn} ${ui.btnGhost}`}>
              ← Ver ventas
            </Link>
          )}
          <button
            type="button"
            className={`${ui.btn} ${ui.btnGhost}`}
            onClick={pickAnotherSale}
          >
            Elegir otra venta
          </button>
        </div>
      ) : null}

      <div className={ui.card} style={{ marginBottom: "1.25rem" }}>
        <span className={styles.catalogFiltersLabel}>1 · Venta original</span>
        {!selectedSale ? (
          <>
            <input
              className={ui.input}
              placeholder="Buscar por fecha, SKU, nombre, folio pedido…"
              value={saleQ}
              onChange={(e) => setSaleQ(e.target.value)}
              style={{ marginBottom: "0.75rem" }}
            />
            <ul className={styles.salesList} style={{ maxHeight: 220, overflow: "auto" }}>
              {filteredSales.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    className={`${ui.btn} ${ui.btnGhost}`}
                    style={{ width: "100%", textAlign: "left", marginBottom: "0.35rem" }}
                    onClick={() => {
                      setSelectedSale(s);
                      setLineIndex(0);
                    }}
                  >
                    <strong>{formatDate(s.at)}</strong> · {formatMoney(s.total)}
                    {s.orderCode ? ` · Pedido ${s.orderCode}` : " · POS"}
                  </button>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <>
            <p style={{ margin: "0 0 0.5rem" }}>
              <strong>{formatDate(selectedSale.at)}</strong> ·{" "}
              {formatMoney(selectedSale.total)}
            </p>
            <label className={styles.catalogFiltersLabel}>
              Línea del ticket
              <select
                className={ui.select}
                value={lineIndex}
                onChange={(e) => setLineIndex(Number(e.target.value))}
              >
                {selectedSale.items.map((_, i) => (
                  <option key={i} value={i}>
                    {lineLabel(selectedSale, i)}
                  </option>
                ))}
              </select>
            </label>
            {remainingQty < lineSoldQty ? (
              <p className={styles.catalogFilterHint}>
                En esta línea vendiste {lineSoldQty}; aún puedes reportar{" "}
                {remainingQty} en garantía (
                {lineSoldQty - remainingQty} ya registrada(s)).
              </p>
            ) : lineSoldQty > 1 ? (
              <p className={styles.catalogFilterHint}>
                Vendiste {lineSoldQty} iguales en esta línea. Indica cuántas
                salieron defectuosas (no tiene que ser todas).
              </p>
            ) : null}
            {remainingQty >= 1 ? (
              <label
                className={styles.catalogFiltersLabel}
                style={{ marginTop: "0.65rem" }}
              >
                Piezas defectuosas
                <div className={styles.stockStepper}>
                  <button
                    type="button"
                    className={styles.stockBtn}
                    disabled={returnQty <= 1}
                    onClick={() => setReturnQty((n) => Math.max(1, n - 1))}
                  >
                    −
                  </button>
                  <span className={styles.stockValue}>{returnQty}</span>
                  <button
                    type="button"
                    className={styles.stockBtn}
                    disabled={returnQty >= remainingQty}
                    onClick={() =>
                      setReturnQty((n) => Math.min(remainingQty, n + 1))
                    }
                  >
                    +
                  </button>
                  <span className={styles.catalogFilterHint} style={{ margin: 0 }}>
                    de {remainingQty} disponible(s) en esta línea
                  </span>
                </div>
              </label>
            ) : (
              <p className={styles.catalogFilterHint} style={{ color: "var(--danger)" }}>
                Garantía completa para esta línea. Elige otra línea o venta.
              </p>
            )}
          </>
        )}
      </div>

      {selectedSale && selectedLine ? (
        <>
          <div className={ui.card} style={{ marginBottom: "1.25rem" }}>
            <span className={styles.catalogFiltersLabel}>2 · Resolución</span>
            <div className={styles.chips} role="tablist">
              {TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  role="tab"
                  aria-selected={warrantyType === t}
                  className={`${styles.chip} ${warrantyType === t ? styles.chipActive : ""}`}
                  onClick={() => {
                    setWarrantyType(t);
                    setReplacement(null);
                  }}
                >
                  {WARRANTY_TYPE_LABELS[t]}
                </button>
              ))}
            </div>
            <p className={styles.catalogFilterHint}>
              Valor de las {returnQty} pieza(s) en garantía:{" "}
              {formatMoney(credit)} (precio unitario{" "}
              {formatMoney(selectedLine.unitPrice)}).
            </p>
          </div>

          {warrantyType !== "refund" ? (
            <div className={ui.card} style={{ marginBottom: "1.25rem" }}>
              <span className={styles.catalogFiltersLabel}>
                3 · Joya de reemplazo ({returnQty} pieza
                {returnQty === 1 ? "" : "s"})
              </span>
              <input
                ref={replaceRef}
                className={ui.input}
                placeholder="Escanear SKU / barras de la joya nueva…"
                value={replaceQ}
                onChange={(e) => setReplaceQ(e.target.value)}
                onKeyDown={onReplaceKeyDown}
              />
              {replacement ? (
                <p style={{ marginTop: "0.65rem" }}>
                  <strong>{replacement.name}</strong> · SKU {replacement.sku} ·{" "}
                  Menudeo {formatMoney(replacement.priceMenudeo)} · Mayoreo{" "}
                  {formatMoney(replacement.priceMayoreo)}
                  <button
                    type="button"
                    className={`${ui.btn} ${ui.btnGhost}`}
                    style={{ marginLeft: "0.5rem" }}
                    onClick={() => setReplacement(null)}
                  >
                    Quitar
                  </button>
                </p>
              ) : null}
              {warrantyType === "same_value" || warrantyType === "price_difference" ? (
                <div style={{ marginTop: "0.75rem" }}>
                  <label className={styles.catalogFiltersLabel}>
                    Comparar con lista (joya nueva)
                    <select
                      className={ui.select}
                      value={tier}
                      onChange={(e) =>
                        setTier(e.target.value as PriceTier)
                      }
                    >
                      <option value="menudeo">Menudeo</option>
                      <option value="mayoreo">Mayoreo</option>
                    </select>
                  </label>
                  <p className={styles.catalogFilterHint}>
                    Lo pagó en la venta:{" "}
                    <strong>{formatMoney(selectedLine.unitPrice)}</strong> por
                    pieza. En {tier} la nueva debe coincidir en total para
                    cambio $0 (menudeo y mayoreo suelen diferir en catálogo).
                  </p>

                  {warrantyType === "same_value" &&
                  replacement &&
                  exchangeBreakdown ? (
                    <div className={styles.warrantyBreakdown}>
                      <div className={styles.warrantyBreakdownTitle}>
                        ¿Mismo valor?
                      </div>
                      <dl className={styles.warrantyBreakdownRows}>
                        <div className={styles.warrantyBreakdownRow}>
                          <dt>Pagó (unitario venta)</dt>
                          <dd>{formatMoney(selectedLine.unitPrice)}</dd>
                        </div>
                        <div className={styles.warrantyBreakdownRow}>
                          <dt>Nueva en {tier}</dt>
                          <dd>
                            {formatMoney(productPrice(replacement, tier))}
                          </dd>
                        </div>
                        <div
                          className={`${styles.warrantyBreakdownRow} ${styles.warrantyBreakdownRowTotal}`}
                        >
                          <dt>Total ({returnQty} pza.)</dt>
                          <dd>
                            {formatMoney(exchangeBreakdown.credit)} vs{" "}
                            {formatMoney(exchangeBreakdown.newTotal)}
                          </dd>
                        </div>
                      </dl>
                      {exchangeBreakdown.diff === 0 ? (
                        <p className={styles.warrantyBreakdownVerdict}>
                          <strong style={{ color: "var(--ok)" }}>
                            Coincide — puedes registrar cambio $0.
                          </strong>
                        </p>
                      ) : (
                        <div className={styles.warrantyBreakdownCallout}>
                          <p>
                            No es el mismo valor con {tier}.{" "}
                            {exchangeBreakdown.diff > 0
                              ? `Falta cobrar ${formatMoney(exchangeBreakdown.extraDue)}.`
                              : `Sobra ${formatMoney(exchangeBreakdown.creditToCustomer)} a favor del cliente.`}
                          </p>
                          <button
                            type="button"
                            className={`${ui.btn} ${ui.btnPrimary}`}
                            onClick={() => {
                              setWarrantyType("price_difference");
                              setChargeManuallyEdited(false);
                              setChargedOverride("");
                            }}
                          >
                            Ir a cambio con diferencia
                          </button>
                        </div>
                      )}
                    </div>
                  ) : null}

                  {warrantyType === "price_difference" &&
                  replacement &&
                  exchangeBreakdown ? (
                    <div className={styles.warrantyBreakdown}>
                      <div className={styles.warrantyBreakdownTitle}>
                        Cuenta del cambio
                      </div>
                      <dl className={styles.warrantyBreakdownRows}>
                        <div className={styles.warrantyBreakdownRow}>
                          <dt>Ya pagó (venta original)</dt>
                          <dd>{formatMoney(exchangeBreakdown.credit)}</dd>
                        </div>
                        <div className={styles.warrantyBreakdownRow}>
                          <dt>
                            Joya nueva ({tier},{" "}
                            {returnQty === 1
                              ? "1 pza"
                              : `${returnQty} pzas`}
                            )
                          </dt>
                          <dd>{formatMoney(exchangeBreakdown.newTotal)}</dd>
                        </div>
                        <div
                          className={`${styles.warrantyBreakdownRow} ${styles.warrantyBreakdownRowTotal}`}
                        >
                          <dt>Diferencia</dt>
                          <dd>
                            {exchangeBreakdown.diff > 0
                              ? `+${formatMoney(exchangeBreakdown.diff)}`
                              : exchangeBreakdown.diff < 0
                                ? `−${formatMoney(exchangeBreakdown.creditToCustomer)}`
                                : formatMoney(0)}
                          </dd>
                        </div>
                      </dl>

                      {exchangeBreakdown.extraDue > 0 ? (
                        <p className={styles.warrantyBreakdownVerdict}>
                          El cliente <strong>debe pagar extra</strong> (nueva
                          joya cuesta más que lo pagado).
                        </p>
                      ) : exchangeBreakdown.diff === 0 ? (
                        <div className={styles.warrantyBreakdownCallout}>
                          <p>
                            <strong>No hay extra.</strong> Mismo valor en
                            precio lista — no cobres diferencia.
                          </p>
                          <button
                            type="button"
                            className={`${ui.btn} ${ui.btnPrimary}`}
                            onClick={() => useSameValueFlow()}
                          >
                            Usar cambio mismo valor ($0)
                          </button>
                        </div>
                      ) : (
                        <div className={styles.warrantyBreakdownCallout}>
                          <p>
                            La nueva cuesta <strong>menos</strong>. A favor del
                            cliente:{" "}
                            <strong>
                              {formatMoney(exchangeBreakdown.creditToCustomer)}
                            </strong>
                            .
                          </p>
                          <button
                            type="button"
                            className={`${ui.btn} ${ui.btnGhost}`}
                            style={{ marginRight: "0.5rem" }}
                            onClick={() =>
                              useSameValueFlow(
                                exchangeBreakdown.creditToCustomer
                              )
                            }
                          >
                            Entregar joya nueva ($0) + devolver{" "}
                            {formatMoney(exchangeBreakdown.creditToCustomer)}
                          </button>
                          <button
                            type="button"
                            className={`${ui.btn} ${ui.btnPrimary}`}
                            onClick={() =>
                              usePartialRefundFlow(
                                exchangeBreakdown.creditToCustomer
                              )
                            }
                          >
                            Solo reembolso (
                            {formatMoney(exchangeBreakdown.creditToCustomer)})
                          </button>
                          <p className={styles.catalogFilterHint}>
                            Si entregas otra joya: usa el primer botón (cambio
                            $0 y devuelves la diferencia en caja). Si solo
                            devuelves dinero sin pieza nueva: reembolso parcial.
                          </p>
                        </div>
                      )}
                    </div>
                  ) : null}

                  {exchangeBreakdown && exchangeBreakdown.extraDue > 0 ? (
                    <label
                      className={styles.catalogFiltersLabel}
                      style={{ marginTop: "0.75rem" }}
                    >
                      Cobrar al cliente (puedes ajustar)
                      <input
                        className={ui.input}
                        inputMode="decimal"
                        value={chargedOverride}
                        onChange={(e) => {
                          setChargeManuallyEdited(true);
                          setChargedOverride(e.target.value);
                        }}
                      />
                      <span className={styles.catalogFilterHint}>
                        Sugerido por la cuenta:{" "}
                        {formatMoney(exchangeBreakdown.extraDue)}. Puedes
                        cobrar otro monto si acuerdan en mostrador.
                      </span>
                    </label>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : (
            <div className={ui.card} style={{ marginBottom: "1.25rem" }}>
              <span className={styles.catalogFiltersLabel}>3 · Reembolso</span>
              <label className={styles.catalogFiltersLabel}>
                Monto a devolver
                <input
                  className={ui.input}
                  inputMode="decimal"
                  placeholder={String(credit)}
                  value={refundOverride}
                  onChange={(e) => setRefundOverride(e.target.value)}
                />
              </label>
              <p className={styles.catalogFilterHint}>
                Por defecto: valor pagado en esa línea ({formatMoney(credit)}).
                En reportes resta del ingreso del periodo.
              </p>
            </div>
          )}

          {moneyDue > 0 ? (
            <div className={ui.card} style={{ marginBottom: "1.25rem" }}>
              <span className={styles.catalogFiltersLabel}>
                {warrantyType === "refund" ? "Forma de devolución" : "Cobro"}
              </span>
              <p style={{ margin: "0 0 0.5rem", fontWeight: 600 }}>
                {warrantyType === "refund"
                  ? `Devolver ${formatMoney(refundAmount)}`
                  : `Cobrar ${formatMoney(chargedAmount)}`}
              </p>
              <select
                className={ui.select}
                value={payment}
                onChange={(e) =>
                  setPayment(e.target.value as SalePaymentMethod)
                }
              >
                {PAYMENTS.map((p) => (
                  <option key={p} value={p}>
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </option>
                ))}
              </select>
              {payment === "mixto" ? (
                <div style={{ marginTop: "0.5rem", display: "grid", gap: "0.35rem" }}>
                  {(["efectivo", "tarjeta", "transferencia"] as const).map(
                    (k) => (
                      <input
                        key={k}
                        className={ui.input}
                        placeholder={k}
                        inputMode="decimal"
                        value={mix[k] ?? ""}
                        onChange={(e) =>
                          setMix((m) => ({
                            ...m,
                            [k]: e.target.value
                              ? Number(e.target.value)
                              : undefined,
                          }))
                        }
                      />
                    )
                  )}
                  <span className={styles.catalogFilterHint}>
                    Suma: {formatMoney(paymentMixTotal(mix))} /{" "}
                    {formatMoney(moneyDue)}
                  </span>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className={ui.card} style={{ marginBottom: "1.25rem" }}>
            <label className={styles.catalogFiltersLabel}>
              Notas (opcional)
              <textarea
                className={ui.input}
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </label>
            <button
              type="button"
              className={`${ui.btn} ${ui.btnPrimary}`}
              disabled={
                busy ||
                inventorySource !== "mongo" ||
                (warrantyType === "same_value" &&
                  Boolean(
                    replacement &&
                      selectedLine &&
                      !isSameValueExchangeAtTier(
                        selectedLine.unitPrice,
                        returnQty,
                        replacement,
                        returnQty,
                        tier
                      )
                  ))
              }
              onClick={() => void submit()}
              style={{ marginTop: "0.75rem" }}
            >
              {busy ? "Guardando…" : "Registrar garantía"}
            </button>
          </div>
        </>
      ) : null}

      <h2 className={styles.sectionTitle}>Historial reciente</h2>
      {history.length === 0 ? (
        <div className={ui.card}>
          <p style={{ margin: 0, color: "var(--text-muted)" }}>
            Aún no hay garantías registradas.
          </p>
        </div>
      ) : (
        <div className={ui.tableWrap}>
          <table className={ui.table}>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Tipo</th>
                <th>Original</th>
                <th>Dinero</th>
              </tr>
            </thead>
            <tbody>
              {history.map((w) => (
                <tr key={w.id}>
                  <td>{formatDate(w.at)}</td>
                  <td>{WARRANTY_TYPE_LABELS[w.type]}</td>
                  <td>
                    {w.originalName}
                    <div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
                      SKU {w.originalSku} · {w.originalQty} pza.
                    </div>
                  </td>
                  <td>
                    {w.type === "refund"
                      ? `−${formatMoney(w.refundAmount)}`
                      : w.chargedAmount > 0
                        ? formatMoney(w.chargedAmount)
                        : "$0"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
