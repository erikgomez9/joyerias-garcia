import { useMemo, useState, type FormEvent } from "react";
import { StockBadge } from "@/components/StockBadge";
import { ProductLabel } from "@/components/ProductLabel";
import { ProductThumb } from "@/components/ProductThumb";
import { usePos } from "@/context/PosContext";
import { PRODUCT_CATEGORIES } from "@/lib/inventoryCodes";
import { METAL_OPTIONS } from "@/lib/materials";
import { formatMoney, metalLabel } from "@/lib/format";
import { downloadInventoryCsv } from "@/lib/exportInventory";
import { applyInventoryModeRules } from "@/lib/inventoryMode";
import {
  isOutOfStock,
  matchesProductStatusFilter,
  PRODUCT_STATUS_FILTERS,
  PRODUCT_STATUS_LABELS,
  productStatusFilterLabel,
  type ProductStatusFilter,
} from "@/lib/stockDisplay";
import type { Metal, Product, ProductInput, ProductStatus } from "@/types";
import ui from "@/components/ui.module.css";
import styles from "./Pages.module.css";

const STATUSES: ProductStatus[] = [
  "disponible",
  "reservado",
  "vendido",
  "taller",
  "danado",
];

const STATUS_CHIP_CLASS: Record<ProductStatusFilter, string> = {
  todos: styles.catalogFilterTodos,
  disponible: styles.catalogFilterDisponible,
  reservado: styles.catalogFilterReservado,
  vendido: styles.catalogFilterVendido,
  taller: styles.catalogFilterTaller,
  danado: styles.catalogFilterDanado,
};

const emptyForm: ProductInput = {
  name: "",
  category: "Anillos",
  metal: "plata",
  metalOther: "",
  stones: "",
  weightGrams: undefined,
  priceMayoreo: 0,
  priceMenudeo: 0,
  inventoryMode: "catalog",
  stock: 1,
  status: "disponible",
  image: "",
  notes: "",
};

export function CatalogPage() {
  const {
    products,
    createProduct,
    updateProduct,
    removeProduct,
    adjustStock,
  } = usePos();
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<ProductStatusFilter>("todos");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<ProductInput>(emptyForm);
  const [labelProduct, setLabelProduct] = useState<Product | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [stockBusyId, setStockBusyId] = useState<string | null>(null);

  async function changeStock(id: string, delta: number) {
    setStockBusyId(id);
    try {
      await adjustStock(id, delta);
    } finally {
      setStockBusyId(null);
    }
  }

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return products.filter((p) => {
      if (!matchesProductStatusFilter(p, statusFilter)) return false;
      if (!term) return true;
      return (
        p.name.toLowerCase().includes(term) ||
        p.sku.toLowerCase().includes(term) ||
        p.barcode.includes(term) ||
        p.category.toLowerCase().includes(term)
      );
    });
  }, [products, q, statusFilter]);

  const totals = useMemo(() => {
    const pieces = products.reduce((s, p) => s + p.stock, 0);
    const value = products.reduce(
      (s, p) => s + p.priceMenudeo * p.stock,
      0
    );
    return { pieces, value, skus: products.length };
  }, [products]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setError("");
    setShowForm(true);
  }

  function openEdit(p: Product) {
    setEditing(p);
    setForm({
      name: p.name,
      category: p.category,
      metal: p.metal,
      metalOther: p.metalOther ?? "",
      stones: p.stones ?? "",
      weightGrams: p.weightGrams,
      priceMayoreo: p.priceMayoreo,
      priceMenudeo: p.priceMenudeo,
      inventoryMode: "catalog",
      stock: p.stock,
      status: p.status,
      image: p.image,
      notes: p.notes ?? "",
    });
    setError("");
    setShowForm(true);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      setError("El nombre de la joya es obligatorio.");
      return;
    }
    if (form.metal === "otro" && !form.metalOther?.trim()) {
      setError("Indica el nombre del otro material.");
      return;
    }
    if (form.priceMayoreo < 0 || form.priceMenudeo < 0) {
      setError("Los precios no pueden ser negativos.");
      return;
    }
    const payload = applyInventoryModeRules({
      ...form,
      inventoryMode: "catalog",
    });
    if (payload.stock < 1) {
      setError("Indica cuántas piezas iguales hay (mínimo 1).");
      return;
    }
    setSaving(true);
    setError("");
    try {
      if (editing) {
        await updateProduct(editing.id, payload);
        setShowForm(false);
        setLabelProduct(null);
        return;
      }
      const created = await createProduct(payload);
      setShowForm(false);
      setLabelProduct(created);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo guardar la joya."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h1 className={ui.pageTitle}>Inventario</h1>
      <p className={ui.pageDesc}>
        Mismo SKU para piezas iguales (mismo diseño y precio). Indica cuántas
        hay en stock; el sistema genera SKU y código de barras.
      </p>

      <div className={ui.gridKpi}>
        <div className={ui.card}>
          <div className={ui.cardMuted}>Piezas (SKU)</div>
          <div className={ui.cardValue}>{totals.skus}</div>
        </div>
        <div className={ui.card}>
          <div className={ui.cardMuted}>Existencias</div>
          <div className={ui.cardValue}>{totals.pieces}</div>
        </div>
        <div className={ui.card}>
          <div className={ui.cardMuted}>Valor en piso</div>
          <div className={ui.cardValue}>{formatMoney(totals.value)}</div>
        </div>
      </div>

      <div className={styles.rowActions}>
        <button type="button" className={`${ui.btn} ${ui.btnPrimary}`} onClick={openCreate}>
          + Nueva joya
        </button>
        <button
          type="button"
          className={ui.btn}
          disabled={products.length === 0}
          onClick={() => downloadInventoryCsv(products)}
        >
          Exportar CSV
        </button>
        <input
          className={ui.input}
          style={{ maxWidth: 360 }}
          placeholder="Buscar por nombre, SKU o código de barras…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {products.length > 0 && (
        <div className={styles.catalogFilters}>
          <span className={styles.catalogFiltersLabel}>Estado</span>
          <div className={styles.chips} role="tablist" aria-label="Estado">
            {PRODUCT_STATUS_FILTERS.map((f) => (
              <button
                key={f}
                type="button"
                role="tab"
                aria-selected={statusFilter === f}
                className={`${styles.chip} ${STATUS_CHIP_CLASS[f]} ${statusFilter === f ? styles.chipActive : ""} ${statusFilter === f ? styles.catalogFilterChipActive : ""}`}
                onClick={() => setStatusFilter(f)}
              >
                {productStatusFilterLabel(f)}
              </button>
            ))}
          </div>
          {statusFilter !== "todos" && (
            <p className={styles.catalogFilterHint}>
              Mostrando {filtered.length} de {products.length} SKU
            </p>
          )}
        </div>
      )}

      {products.length === 0 ? (
        <div className={ui.card}>
          <p style={{ margin: 0, color: "var(--text-muted)" }}>
            El inventario está vacío. Registra la primera joya: se generarán
            automáticamente el SKU y el código de barras.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className={ui.card}>
          <p style={{ margin: 0, color: "var(--text-muted)" }}>
            No hay piezas con este estado y búsqueda. Prueba otro filtro.
          </p>
        </div>
      ) : (
        <div className={ui.tableWrap}>
          <table className={ui.table}>
            <thead>
              <tr>
                <th>Foto</th>
                <th>SKU</th>
                <th>Código barras</th>
                <th>Pieza</th>
                <th>Material</th>
                <th>Mayoreo</th>
                <th>Menudeo</th>
                <th>Stock</th>
                <th>Estado</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr
                  key={p.id}
                  className={isOutOfStock(p) ? styles.rowOutOfStock : undefined}
                >
                  <td>
                    <ProductThumb src={p.image} alt={p.name} />
                  </td>
                  <td>
                    <span className={ui.badge}>{p.sku}</span>
                  </td>
                  <td style={{ fontFamily: "monospace", fontSize: "0.8rem" }}>
                    {p.barcode}
                  </td>
                  <td>
                    <strong>{p.name}</strong>
                    <div style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>
                      {p.category}
                      {p.stones ? ` · ${p.stones}` : ""}
                    </div>
                  </td>
                  <td>{metalLabel(p.metal, p.metalOther)}</td>
                  <td>{formatMoney(p.priceMayoreo)}</td>
                  <td>{formatMoney(p.priceMenudeo)}</td>
                  <td>
                    <div className={styles.stockStepper}>
                      <button
                        type="button"
                        className={styles.stockBtn}
                        aria-label="Quitar una pieza del stock"
                        disabled={p.stock <= 0 || stockBusyId === p.id}
                        onClick={() => void changeStock(p.id, -1)}
                      >
                        −
                      </button>
                      <StockBadge stock={p.stock} status={p.status} />
                      <button
                        type="button"
                        className={styles.stockBtn}
                        aria-label="Agregar una pieza al stock"
                        disabled={stockBusyId === p.id}
                        onClick={() => void changeStock(p.id, 1)}
                      >
                        +
                      </button>
                    </div>
                  </td>
                  <td>
                    <span
                      className={
                        isOutOfStock(p) ? styles.statusOut : undefined
                      }
                    >
                      {PRODUCT_STATUS_LABELS[p.status] ?? p.status}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
                      <button
                        type="button"
                        className={ui.btn}
                        onClick={() => setLabelProduct(p)}
                      >
                        Etiqueta
                      </button>
                      <button
                        type="button"
                        className={ui.btn}
                        onClick={() => openEdit(p)}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className={`${ui.btn} ${ui.btnDanger}`}
                        onClick={() => {
                          if (confirm(`¿Eliminar ${p.name}?`)) {
                            void removeProduct(p.id);
                          }
                        }}
                      >
                        Borrar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <div className={styles.modalOverlay} onClick={() => setShowForm(false)}>
          <div
            className={`${styles.modal} ${styles.modalWide}`}
            onClick={(e) => e.stopPropagation()}
          >
            <h3>{editing ? "Editar joya" : "Alta de joya"}</h3>
            {!editing && (
              <p className={styles.formHint}>
                SKU y código de barras se generan solos al guardar. No hace falta
                escribirlos.
              </p>
            )}
            {editing && (
              <p className={styles.formHint}>
                SKU <strong>{editing.sku}</strong> · Barras{" "}
                <strong>{editing.barcode}</strong> (no cambian)
              </p>
            )}
            <form className={styles.formGrid} onSubmit={onSubmit}>
              <label className={styles.fieldFull}>
                <span>Nombre</span>
                <input
                  className={ui.input}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ej. Anillo solitario diamante"
                  required
                />
              </label>
              <label>
                <span>Categoría</span>
                <select
                  className={ui.select}
                  value={form.category}
                  onChange={(e) =>
                    setForm({ ...form, category: e.target.value })
                  }
                  disabled={!!editing}
                >
                  {PRODUCT_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Material</span>
                <select
                  className={ui.select}
                  value={form.metal ?? ""}
                  onChange={(e) => {
                    const metal = (e.target.value || undefined) as
                      | Metal
                      | undefined;
                    setForm({
                      ...form,
                      metal,
                      metalOther: metal === "otro" ? form.metalOther : "",
                    });
                  }}
                >
                  <option value="">—</option>
                  {METAL_OPTIONS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </label>
              {form.metal === "otro" && (
                <label>
                  <span>Especificar material</span>
                  <input
                    className={ui.input}
                    value={form.metalOther ?? ""}
                    onChange={(e) =>
                      setForm({ ...form, metalOther: e.target.value })
                    }
                    placeholder="Ej. titanio, latón, resina…"
                    required
                  />
                </label>
              )}
              <label>
                <span>Piedras</span>
                <input
                  className={ui.input}
                  value={form.stones ?? ""}
                  onChange={(e) =>
                    setForm({ ...form, stones: e.target.value })
                  }
                  placeholder="Opcional"
                />
              </label>
              <label>
                <span>Peso (g)</span>
                <input
                  className={ui.input}
                  type="number"
                  min={0}
                  step={0.01}
                  value={form.weightGrams ?? ""}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      weightGrams: e.target.value
                        ? Number(e.target.value)
                        : undefined,
                    })
                  }
                />
              </label>
              <label>
                <span>Precio mayoreo</span>
                <input
                  className={ui.input}
                  type="number"
                  min={0}
                  step={1}
                  value={form.priceMayoreo || ""}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      priceMayoreo: Number(e.target.value) || 0,
                    })
                  }
                  required
                />
              </label>
              <label>
                <span>Precio menudeo</span>
                <input
                  className={ui.input}
                  type="number"
                  min={0}
                  step={1}
                  value={form.priceMenudeo || ""}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      priceMenudeo: Number(e.target.value) || 0,
                    })
                  }
                  required
                />
              </label>
              <label>
                <span>Existencias (piezas iguales)</span>
                <input
                  className={ui.input}
                  type="number"
                  min={1}
                  step={1}
                  value={form.stock}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      stock: Number(e.target.value) || 0,
                    })
                  }
                />
              </label>
              <label>
                <span>Estado</span>
                <select
                  className={ui.select}
                  value={form.status ?? "disponible"}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      status: e.target.value as ProductStatus,
                    })
                  }
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.fieldFull}>
                <span>URL foto (opcional)</span>
                <input
                  className={ui.input}
                  value={form.image ?? ""}
                  onChange={(e) => setForm({ ...form, image: e.target.value })}
                  placeholder="https://…"
                />
              </label>
              <label className={styles.fieldFull}>
                <span>Notas</span>
                <input
                  className={ui.input}
                  value={form.notes ?? ""}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Talla, proveedor, observaciones…"
                />
              </label>
              {error && <p className={styles.formError}>{error}</p>}
              <div className={`${styles.modalActions} ${styles.fieldFull}`}>
                <button
                  type="button"
                  className={`${ui.btn} ${ui.btnGhost}`}
                  onClick={() => setShowForm(false)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className={`${ui.btn} ${ui.btnPrimary}`}
                  disabled={saving}
                >
                  {saving
                    ? "Guardando…"
                    : editing
                      ? "Guardar cambios"
                      : "Registrar y generar códigos"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {labelProduct && (
        <ProductLabel
          product={labelProduct}
          onClose={() => setLabelProduct(null)}
        />
      )}
    </div>
  );
}
