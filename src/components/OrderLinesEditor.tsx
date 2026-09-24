import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { PosProductConfirm } from "@/components/PosProductConfirm";
import { formatMoney } from "@/lib/format";
import { orderLinesTotal } from "@/lib/orderLabels";
import {
  applyOrderPricing,
  orderPriceTierHint,
  priceTierForOrderLines,
  priceTierLabel,
} from "@/lib/orderPricing";
import { productPrice } from "@/lib/format";
import { posProductBlockReason } from "@/lib/productAvailability";
import { findProductByScan } from "@/lib/posScan";
import { uid } from "@/lib/inventoryCodes";
import { productDisplayName } from "@/lib/productSize";
import type { OrderLine, Product } from "@/types";
import ui from "@/components/ui.module.css";
import styles from "./OrderLinesEditor.module.css";

export type DraftOrderLine = OrderLine & { key: string };

interface Props {
  lines: DraftOrderLine[];
  onChange: (lines: DraftOrderLine[]) => void;
  products: Product[];
  disabled?: boolean;
}

export function OrderLinesEditor({
  lines,
  onChange,
  products,
  disabled,
}: Props) {
  const scanRef = useRef<HTMLInputElement>(null);
  const [scanQ, setScanQ] = useState("");
  const [scanMsg, setScanMsg] = useState("");
  const [pickId, setPickId] = useState("");
  const [confirmProduct, setConfirmProduct] = useState<Product | null>(null);
  const [customName, setCustomName] = useState("");
  const [customPrice, setCustomPrice] = useState("");

  const total = orderLinesTotal(lines);
  const priceTier = priceTierForOrderLines(lines, products);
  const tierHint = orderPriceTierHint(lines, products);

  function commitLines(next: DraftOrderLine[]) {
    onChange(applyOrderPricing(next, products));
  }

  useEffect(() => {
    if (!disabled) scanRef.current?.focus();
  }, [disabled]);

  function resolveProduct(p: Product): Product {
    return products.find((x) => x.id === p.id) ?? p;
  }

  function openConfirm(raw: Product) {
    const product = resolveProduct(raw);
    const block = posProductBlockReason(product);
    if (block) {
      setScanMsg(block);
      return;
    }
    setScanMsg("");
    setConfirmProduct(product);
  }

  function tryScan(code: string) {
    const hit = findProductByScan(products, code);
    if (!hit) {
      setScanMsg("Código no encontrado.");
      return;
    }
    openConfirm(hit);
    setScanQ("");
  }

  function onScanKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const term = scanQ.trim();
    if (!term) return;
    tryScan(term);
  }

  function addProductLine(product: Product, qty: number) {
    const p = resolveProduct(product);
    const cap = Math.min(qty, p.stock);
    const existing = lines.find((l) => l.productId === p.id);
    if (existing) {
      const nextQty = Math.min(existing.qty + cap, p.stock);
      commitLines(
        lines.map((l) =>
          l.key === existing.key ? { ...l, qty: nextQty } : l
        )
      );
    } else {
      commitLines([
        ...lines,
        {
          key: uid(),
          productId: p.id,
          sku: p.sku,
          name: productDisplayName(p),
          qty: cap,
          unitPrice: productPrice(p, priceTier),
        },
      ]);
    }
    setScanMsg(`Agregado: ${productDisplayName(p)}`);
    scanRef.current?.focus();
  }

  function addFromPickList() {
    if (!pickId) return;
    const p = products.find((x) => x.id === pickId);
    if (!p) return;
    openConfirm(p);
    setPickId("");
  }

  function addCustom() {
    const name = customName.trim();
    const price = parseFloat(customPrice.replace(",", "."));
    if (!name || !Number.isFinite(price) || price < 0) return;
    commitLines([
      ...lines,
      {
        key: uid(),
        name,
        qty: 1,
        unitPrice: price,
      },
    ]);
    setCustomName("");
    setCustomPrice("");
  }

  function updateLine(key: string, patch: Partial<DraftOrderLine>) {
    commitLines(lines.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function removeLine(key: string) {
    commitLines(lines.filter((l) => l.key !== key));
  }

  const available = products.filter(
    (p) => p.stock > 0 && p.status === "disponible"
  );

  return (
    <div className={styles.editor}>
      <h4 className={styles.heading}>Piezas y conceptos</h4>

      <div className={styles.scanBlock}>
        <input
          ref={scanRef}
          className={ui.input}
          placeholder="Escanea o escribe SKU / código de barras…"
          value={scanQ}
          disabled={disabled}
          onChange={(e) => {
            setScanQ(e.target.value);
            if (scanMsg) setScanMsg("");
          }}
          onKeyDown={onScanKeyDown}
          aria-label="Escanear pieza para el pedido"
        />
        <p className={styles.scanHint}>
          Igual que en punto de venta: escanea y confirma con la foto.
        </p>
        {scanMsg && (
          <p
            className={styles.scanMsg}
            style={{
              color: scanMsg.startsWith("Agregado")
                ? "var(--gold)"
                : "var(--danger)",
            }}
          >
            {scanMsg}
          </p>
        )}
      </div>

      <div className={styles.addRow}>
        <select
          className={ui.input}
          value={pickId}
          disabled={disabled}
          onChange={(e) => setPickId(e.target.value)}
        >
          <option value="">Buscar en listado (sin escáner)…</option>
          {available.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.sku}) · {formatMoney(p.priceMenudeo)}
            </option>
          ))}
        </select>
        <button
          type="button"
          className={`${ui.btn} ${ui.btnGhost}`}
          disabled={disabled || !pickId}
          onClick={addFromPickList}
        >
          Verificar
        </button>
      </div>

      <details className={styles.conceptDetails}>
        <summary>Servicio o concepto sin código</summary>
        <div className={styles.addCustom}>
          <input
            className={ui.input}
            placeholder="Ej. soldadura, baño de oro…"
            value={customName}
            disabled={disabled}
            onChange={(e) => setCustomName(e.target.value)}
          />
          <input
            type="number"
            min={0}
            step="1"
            className={ui.input}
            placeholder="Precio"
            value={customPrice}
            disabled={disabled}
            onChange={(e) => setCustomPrice(e.target.value)}
          />
          <button
            type="button"
            className={`${ui.btn} ${ui.btnGhost}`}
            disabled={disabled}
            onClick={addCustom}
          >
            Agregar
          </button>
        </div>
      </details>

      {lines.length === 0 ? (
        <p className={styles.hint}>
          Escanea una etiqueta o elige del listado para armar el pedido.
        </p>
      ) : (
        <ul className={styles.lines}>
          {lines.map((line) => (
            <li key={line.key} className={styles.line}>
              <div className={styles.lineMain}>
                <span className={styles.lineName}>{line.name}</span>
                {line.sku && (
                  <span className={styles.lineSku}>{line.sku}</span>
                )}
              </div>
              <div className={styles.lineControls}>
                <label className={styles.qtyLabel}>
                  Cant.
                  <input
                    type="number"
                    min={1}
                    className={styles.qtyInput}
                    value={line.qty}
                    disabled={disabled}
                    onChange={(e) =>
                      updateLine(line.key, {
                        qty: Math.max(1, parseInt(e.target.value, 10) || 1),
                      })
                    }
                  />
                </label>
                <label className={styles.priceLabel}>
                  P. unit.
                  <input
                    type="number"
                    min={0}
                    step="1"
                    className={styles.priceInput}
                    value={line.unitPrice}
                    disabled={disabled}
                    onChange={(e) =>
                      updateLine(line.key, {
                        unitPrice: parseFloat(e.target.value) || 0,
                      })
                    }
                  />
                </label>
                <span className={styles.lineSub}>
                  {formatMoney(line.unitPrice * line.qty)}
                </span>
                <button
                  type="button"
                  className={styles.removeBtn}
                  disabled={disabled}
                  aria-label="Quitar línea"
                  onClick={() => removeLine(line.key)}
                >
                  ×
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className={styles.tierHint}>
        {tierHint}{" "}
        <span className={styles.tierBadge}>
          ({priceTierLabel(priceTier)})
        </span>
      </p>

      <div className={styles.footerTotal}>
        <span>Total del pedido</span>
        <strong>{formatMoney(total)}</strong>
      </div>

      {confirmProduct && (
        <PosProductConfirm
          product={confirmProduct}
          title="¿Es esta joya para el pedido?"
          subtitle="Revisa la foto antes de agregar al pedido."
          confirmLabel="Agregar al pedido"
          onClose={() => setConfirmProduct(null)}
          onConfirm={(qty) => {
            addProductLine(confirmProduct, qty);
            setConfirmProduct(null);
          }}
        />
      )}
    </div>
  );
}

export function draftToOrderLines(lines: DraftOrderLine[]): OrderLine[] {
  return lines.map(({ key: _k, ...rest }) => rest);
}

export function orderToDraftLines(items: OrderLine[]): DraftOrderLine[] {
  return items.map((line) => ({ ...line, key: uid() }));
}
