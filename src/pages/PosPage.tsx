import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { PosCheckoutReview } from "@/components/PosCheckoutReview";
import { PosProductConfirm } from "@/components/PosProductConfirm";
import { ProductThumb } from "@/components/ProductThumb";
import { SaleReceipt } from "@/components/SaleReceipt";
import { usePos } from "@/context/PosContext";
import { formatMoney, productPrice } from "@/lib/format";
import {
  cartTotal,
  priceTierForCart,
  priceTierHint,
  priceTierLabel,
} from "@/lib/salePricing";
import { StockBadge } from "@/components/StockBadge";
import {
  isProductSellableAtPos,
  posProductBlockReason,
} from "@/lib/productAvailability";
import { isOutOfStock } from "@/lib/stockDisplay";
import { productDisplayName } from "@/lib/productSize";
import { findProductByScan } from "@/lib/posScan";
import {
  paymentMixTotal,
  validatePaymentMix,
} from "@/lib/paymentMix";
import type { PaymentMix, Product, SaleRecord, SalePaymentMethod } from "@/types";
import ui from "@/components/ui.module.css";
import styles from "./Pages.module.css";

export function PosPage() {
  const {
    products,
    cart,
    addToCart,
    setQty,
    removeLine,
    clearCart,
    checkout,
    refreshProductsQuiet,
  } = usePos();

  useEffect(() => {
    void refreshProductsQuiet();
  }, [refreshProductsQuiet]);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");
  const [lastSale, setLastSale] = useState<SaleRecord | null>(null);
  const [scanMsg, setScanMsg] = useState("");
  const [showCatalog, setShowCatalog] = useState(false);
  const [confirmProduct, setConfirmProduct] = useState<Product | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const categories = useMemo(() => {
    const s = new Set(products.map((p) => p.category));
    return Array.from(s).sort();
  }, [products]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return products.filter((p) => {
      const okCat = !cat || p.category === cat;
      if (!term) return okCat;
      const hay =
        p.name.toLowerCase().includes(term) ||
        p.sku.toLowerCase().includes(term) ||
        p.barcode?.toLowerCase().includes(term) ||
        (p.size?.toLowerCase().includes(term) ?? false);
      return okCat && hay;
    });
  }, [products, q, cat]);

  const priceTier = useMemo(() => priceTierForCart(cart), [cart]);
  const total = useMemo(() => cartTotal(cart), [cart]);
  const tierHint = useMemo(
    () => priceTierHint(cart, priceTier),
    [cart, priceTier]
  );

  function resolveProduct(p: Product): Product {
    return products.find((x) => x.id === p.id) ?? p;
  }

  function openProductConfirm(product: Product) {
    const fresh = resolveProduct(product);
    const block = posProductBlockReason(fresh);
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
    openProductConfirm(hit);
    setQ("");
  }

  function confirmAdd(qty: number) {
    if (!confirmProduct) return;
    addToCart(resolveProduct(confirmProduct), qty);
    setScanMsg(`Agregado: ${confirmProduct.name} (${qty})`);
    setConfirmProduct(null);
    searchRef.current?.focus();
  }

  function onSearchKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const term = q.trim();
    if (!term) return;
    tryScan(term);
  }

  return (
    <div className={styles.posPage}>
      <header className={styles.posPageHeader}>
        <h1 className={ui.pageTitle}>Punto de venta</h1>
        <p className={`${ui.pageDesc} ${styles.posPageDesc}`}>
          Escanea la etiqueta: verás la foto para confirmar. Mayoreo si el
          ticket en menudeo llega a $500+.
        </p>
      </header>

      <div className={styles.posLayout}>
        <section className={styles.posScanSection}>
          <div className={styles.posToolbar}>
            <input
              ref={searchRef}
              className={ui.input}
              placeholder="Escanea o escribe SKU / código de barras…"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                if (scanMsg) setScanMsg("");
              }}
              onKeyDown={onSearchKeyDown}
              aria-label="Buscar o escanear productos"
              autoFocus
            />
          </div>
          {scanMsg && (
            <p
              className={styles.posScanMsg}
              style={{
                color: scanMsg.startsWith("Agregado")
                  ? "var(--gold)"
                  : "var(--danger)",
              }}
            >
              {scanMsg}
            </p>
          )}
          <button
            type="button"
            className={`${ui.btn} ${ui.btnGhost} ${styles.posCatalogBtn}`}
            onClick={() => setShowCatalog((v) => !v)}
          >
            {showCatalog ? "Ocultar listado" : "Buscar en listado (sin escáner)"}
          </button>

          {showCatalog && (
            <>
              <div className={styles.chips} style={{ marginTop: "0.75rem" }}>
                <button
                  type="button"
                  className={`${styles.chip} ${!cat ? styles.chipActive : ""}`}
                  onClick={() => setCat(null)}
                >
                  Todas
                </button>
                {categories.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`${styles.chip} ${cat === c ? styles.chipActive : ""}`}
                    onClick={() => setCat(c)}
                  >
                    {c}
                  </button>
                ))}
              </div>
              <ul className={styles.posPickList}>
                {filtered.map((p) => {
                  const fresh = resolveProduct(p);
                  return (
                    <li
                      key={p.id}
                      className={`${styles.posPickItem} ${isOutOfStock(fresh) ? styles.posPickItemOut : ""}`}
                    >
                      <ProductThumb src={fresh.image} alt={fresh.name} />
                      <div className={styles.posPickInfo}>
                        <div className={styles.posPickName}>
                          {productDisplayName(fresh)}
                        </div>
                        <div className={styles.posPickMeta}>
                          {fresh.sku} ·{" "}
                          <StockBadge
                            stock={fresh.stock}
                            status={fresh.status}
                          />
                        </div>
                      </div>
                      <button
                        type="button"
                        className={ui.btn}
                        disabled={!isProductSellableAtPos(fresh)}
                        onClick={() => openProductConfirm(fresh)}
                      >
                        Verificar
                      </button>
                    </li>
                  );
                })}
              </ul>
              {filtered.length === 0 && (
                <p className={ui.pageDesc}>No hay piezas que coincidan.</p>
              )}
            </>
          )}

          {!showCatalog && (
            <p className={styles.posScanHint}>
              Enfoca el cursor en el campo de arriba y escanea. Si no hay
              lector, abre el listado.
            </p>
          )}
        </section>

        <aside className={styles.cartSticky}>
          <div className={styles.cartBox}>
            <h2 className={styles.cartTitle}>Ticket</h2>
            <div className={styles.cartLines}>
              {cart.length === 0 && (
                <p className={styles.cartEmpty}>
                  Escanea una etiqueta para agregar piezas.
                </p>
              )}
              {cart.map((line) => (
                <div key={line.product.id} className={styles.cartLine}>
                  <div>
                    <div className={styles.cartLineName}>
                      {productDisplayName(line.product)}
                    </div>
                    <div className={styles.cartLineMeta}>
                      {line.product.sku} ·{" "}
                      {formatMoney(productPrice(line.product, priceTier))} c/u
                      ({priceTierLabel(priceTier)})
                    </div>
                  </div>
                  <div className={styles.qtyRow}>
                    <button
                      type="button"
                      className={styles.qtyBtn}
                      aria-label="Menos"
                      onClick={() => setQty(line.product.id, line.qty - 1)}
                    >
                      −
                    </button>
                    <span className={styles.qtyVal}>{line.qty}</span>
                    <button
                      type="button"
                      className={styles.qtyBtn}
                      aria-label="Más"
                      onClick={() =>
                        addToCart(resolveProduct(line.product), 1)
                      }
                    >
                      +
                    </button>
                    <button
                      type="button"
                      className={`${ui.btn} ${ui.btnDanger}`}
                      style={{ padding: "0.25rem 0.5rem", fontSize: "0.75rem" }}
                      onClick={() => removeLine(line.product.id)}
                    >
                      Quitar
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <p className={styles.cartHint}>{tierHint}</p>
            <div className={styles.cartTotal}>
              <span className={styles.cartTotalLabel}>
                Total ({priceTierLabel(priceTier)})
              </span>
              <span className={styles.cartTotalValue}>{formatMoney(total)}</span>
            </div>
            <div className={styles.cartActions}>
              <div className={styles.cartActionsRow}>
                <button
                  type="button"
                  className={`${ui.btn} ${ui.btnGhost} ${styles.cartActionBtn}`}
                  disabled={cart.length === 0 || checkingOut}
                  onClick={() => clearCart()}
                >
                  Vaciar
                </button>
                <button
                  type="button"
                  className={`${ui.btn} ${ui.btnPrimary} ${styles.cartActionBtn} ${styles.cartActionPrimary}`}
                  disabled={cart.length === 0 || checkingOut}
                  onClick={() => {
                    setCheckoutError("");
                    setReviewOpen(true);
                  }}
                >
                  Cobrar
                </button>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {confirmProduct && (
        <PosProductConfirm
          product={confirmProduct}
          onClose={() => setConfirmProduct(null)}
          onConfirm={confirmAdd}
        />
      )}

      {reviewOpen && (
        <PosCheckoutReview
          lines={cart}
          onBack={() => setReviewOpen(false)}
          onContinue={() => {
            setReviewOpen(false);
            setPayOpen(true);
          }}
        />
      )}

      {payOpen && (
        <PaymentModal
          total={total}
          busy={checkingOut}
          error={checkoutError}
          onClose={() => !checkingOut && setPayOpen(false)}
          onConfirm={async (method, paymentMix) => {
            setCheckingOut(true);
            setCheckoutError("");
            try {
              const sale = await checkout(method, paymentMix);
              setPayOpen(false);
              setLastSale(sale);
            } catch (err) {
              setCheckoutError(
                err instanceof Error ? err.message : "No se pudo cobrar."
              );
            } finally {
              setCheckingOut(false);
            }
          }}
        />
      )}

      {lastSale && (
        <SaleReceipt sale={lastSale} onClose={() => setLastSale(null)} />
      )}
    </div>
  );
}

function PaymentModal({
  total,
  busy,
  error,
  onClose,
  onConfirm,
}: {
  total: number;
  busy: boolean;
  error: string;
  onClose: () => void;
  onConfirm: (
    m: SalePaymentMethod,
    mix?: PaymentMix
  ) => void | Promise<void>;
}) {
  const simpleMethods: SalePaymentMethod[] = [
    "efectivo",
    "tarjeta",
    "transferencia",
  ];
  const [mixOpen, setMixOpen] = useState(false);
  const [mixEfectivo, setMixEfectivo] = useState("");
  const [mixTarjeta, setMixTarjeta] = useState("");
  const [mixTransferencia, setMixTransferencia] = useState("");
  const [mixError, setMixError] = useState("");

  function parseAmount(raw: string): number {
    const n = parseFloat(raw.trim().replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  }

  function currentMix(): PaymentMix {
    return {
      efectivo: parseAmount(mixEfectivo),
      tarjeta: parseAmount(mixTarjeta),
      transferencia: parseAmount(mixTransferencia),
    };
  }

  function submitMix() {
    const mix = currentMix();
    const err = validatePaymentMix(mix, total);
    if (err) {
      setMixError(err);
      return;
    }
    setMixError("");
    void onConfirm("mixto", mix);
  }

  return (
    <div
      className={styles.modalOverlay}
      role="dialog"
      aria-modal
      aria-labelledby="pay-title"
      onClick={(e) => e.target === e.currentTarget && !busy && onClose()}
    >
      <div className={styles.modal}>
        <h3 id="pay-title">
          {mixOpen ? "Pago mixto" : "Forma de pago"}
        </h3>
        <p className={ui.pageDesc} style={{ marginBottom: "1rem" }}>
          Total a cobrar: <strong>{formatMoney(total)}</strong>
        </p>
        {error && (
          <p style={{ color: "var(--danger)", fontSize: "0.9rem" }}>{error}</p>
        )}

        {!mixOpen ? (
          <>
            <div
              style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}
            >
              {simpleMethods.map((m) => (
                <button
                  key={m}
                  type="button"
                  className={ui.btn}
                  disabled={busy}
                  onClick={() => void onConfirm(m)}
                >
                  {busy ? "Procesando…" : m.charAt(0).toUpperCase() + m.slice(1)}
                </button>
              ))}
              <button
                type="button"
                className={ui.btn}
                disabled={busy}
                onClick={() => {
                  setMixError("");
                  setMixOpen(true);
                }}
              >
                Mixto (efectivo + tarjeta…)
              </button>
            </div>
            <div className={styles.modalActions}>
              <button
                type="button"
                className={`${ui.btn} ${ui.btnGhost}`}
                disabled={busy}
                onClick={onClose}
              >
                Cancelar
              </button>
            </div>
          </>
        ) : (
          <>
            <p className={styles.payMixHint}>
              Reparte el total entre al menos dos formas. La suma debe coincidir
              con el total.
            </p>
            <div className={styles.payMixFields}>
              <label className={styles.payMixField}>
                <span>Efectivo</span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  className={ui.input}
                  value={mixEfectivo}
                  onChange={(e) => setMixEfectivo(e.target.value)}
                  disabled={busy}
                />
              </label>
              <label className={styles.payMixField}>
                <span>Tarjeta</span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  className={ui.input}
                  value={mixTarjeta}
                  onChange={(e) => setMixTarjeta(e.target.value)}
                  disabled={busy}
                />
              </label>
              <label className={styles.payMixField}>
                <span>Transferencia</span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  className={ui.input}
                  value={mixTransferencia}
                  onChange={(e) => setMixTransferencia(e.target.value)}
                  disabled={busy}
                />
              </label>
            </div>
            <p className={styles.payMixSum}>
              Suma:{" "}
              <strong>{formatMoney(paymentMixTotal(currentMix()))}</strong>
              {" · "}
              Falta:{" "}
              <strong>
                {formatMoney(Math.max(0, total - paymentMixTotal(currentMix())))}
              </strong>
            </p>
            {mixError && (
              <p style={{ color: "var(--danger)", fontSize: "0.85rem" }}>
                {mixError}
              </p>
            )}
            <div className={styles.modalActions}>
              <button
                type="button"
                className={`${ui.btn} ${ui.btnGhost}`}
                disabled={busy}
                onClick={() => setMixOpen(false)}
              >
                Volver
              </button>
              <button
                type="button"
                className={`${ui.btn} ${ui.btnPrimary}`}
                disabled={busy}
                onClick={submitMix}
              >
                {busy ? "Procesando…" : "Confirmar mixto"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
