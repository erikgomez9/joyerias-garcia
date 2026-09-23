import { useMemo, useState, type FormEvent, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  OrderLinesEditor,
  draftToOrderLines,
  orderToDraftLines,
  type DraftOrderLine,
} from "@/components/OrderLinesEditor";
import { OrderItemsTable } from "@/components/OrderItemsTable";
import { usePos } from "@/context/PosContext";
import { orderLinesTotal } from "@/lib/orderLabels";
import { formatMoney } from "@/lib/format";
import {
  ACTIVE_ORDER_STATUSES,
  ORDER_STATUS_FILTERS,
  ORDER_STATUS_LABELS,
  orderStatusFilterLabel,
  matchesOrderStatusFilter,
  orderBalance,
  orderIsFullyPaid,
  orderSummary,
  type OrderStatusFilter,
} from "@/lib/orderLabels";
import type {
  OrderInput,
  OrderLine,
  OrderRecord,
  OrderStatus,
} from "@/types";
import ui from "@/components/ui.module.css";
import styles from "./Pages.module.css";

const STATUS_FILTER_CHIP_CLASS: Record<OrderStatusFilter, string> = {
  activos: styles.orderFilterActivos,
  pendiente: styles.orderFilterPendiente,
  listo: styles.orderFilterListo,
  entregado: styles.orderFilterEntregado,
  cancelado: styles.orderFilterCancelado,
  todos: styles.orderFilterTodos,
};

const STATUS_BADGE_CLASS: Record<OrderStatus, string> = {
  pendiente: styles.orderStatusPendiente,
  listo: styles.orderStatusListo,
  entregado: styles.orderStatusEntregado,
  cancelado: styles.orderStatusCancelado,
};

type NewOrderForm = {
  clientId: string;
  clientName: string;
  clientPhone: string;
  dejoHoy: string;
};

const emptyForm: NewOrderForm = {
  clientId: "",
  clientName: "",
  clientPhone: "",
  dejoHoy: "",
};

function orderDisplayItems(order: OrderRecord): OrderLine[] {
  if (order.items?.length) return order.items;
  return [
    {
      name: orderSummary(order),
      qty: 1,
      unitPrice: order.totalAmount,
    },
  ];
}

const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  pendiente: "listo",
  listo: "entregado",
};

export function OrdersPage() {
  const {
    orders,
    clients,
    products,
    inventorySource,
    createOrder,
    updateOrder,
    addOrderDeposit,
  } = usePos();
  const [searchParams, setSearchParams] = useSearchParams();
  const [statusFilter, setStatusFilter] =
    useState<OrderStatusFilter>("activos");
  const [q, setQ] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<NewOrderForm>(emptyForm);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<OrderRecord | null>(null);
  const [draftLines, setDraftLines] = useState<DraftOrderLine[]>([]);
  const [showEditItems, setShowEditItems] = useState(false);
  const [editLines, setEditLines] = useState<DraftOrderLine[]>([]);
  const [depositAmount, setDepositAmount] = useState("");
  const [detailBusy, setDetailBusy] = useState(false);

  const mongo = inventorySource === "mongo";

  const prefillClientId = searchParams.get("cliente") ?? "";

  useEffect(() => {
    if (!prefillClientId || !mongo) return;
    const c = clients.find((x) => x.id === prefillClientId);
    if (!c) return;
    setForm((f) => ({
      ...f,
      clientId: c.id,
      clientName: c.name,
      clientPhone: c.phone,
    }));
    setShowForm(true);
    setSearchParams({}, { replace: true });
  }, [prefillClientId, clients, mongo, setSearchParams]);

  const filtered = useMemo(() => {
    let list = orders;
    list = list.filter((o) => matchesOrderStatusFilter(o.status, statusFilter));
    const term = q.trim().toLowerCase();
    if (!term) return list;
    return list.filter(
      (o) =>
        o.orderCode.toLowerCase().includes(term) ||
        o.clientName.toLowerCase().includes(term) ||
        o.title.toLowerCase().includes(term) ||
        o.description?.toLowerCase().includes(term) ||
        o.productName?.toLowerCase().includes(term) ||
        o.items?.some((i) => i.name.toLowerCase().includes(term))
    );
  }, [orders, statusFilter, q]);

  const openOrders = useMemo(
    () => orders.filter((o) => ACTIVE_ORDER_STATUSES.includes(o.status)).length,
    [orders]
  );

  function openCreate() {
    setForm({ ...emptyForm });
    setDraftLines([]);
    setFormError("");
    setShowForm(true);
  }

  const selectedLive = useMemo(() => {
    if (!selected) return null;
    return orders.find((o) => o.id === selected.id) ?? selected;
  }, [selected, orders]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.clientId && !form.clientName?.trim()) {
      setFormError("Elige un cliente o escribe su nombre.");
      return;
    }
    if (draftLines.length === 0) {
      setFormError("Agrega al menos una pieza o concepto al pedido.");
      return;
    }

    const items = draftToOrderLines(draftLines);
    const total = orderLinesTotal(items);
    const dejoHoy = parseFloat(form.dejoHoy.replace(",", "."));
    const depositPaid =
      Number.isFinite(dejoHoy) && dejoHoy > 0 ? dejoHoy : 0;
    if (depositPaid > total) {
      setFormError("Lo que dejó hoy no puede ser mayor al total del pedido.");
      return;
    }

    const payload: OrderInput = {
      kind: "encargo",
      items,
      depositPaid,
      clientId: form.clientId || undefined,
      clientName: form.clientName?.trim() || undefined,
      clientPhone: form.clientPhone?.trim() || undefined,
    };

    setSaving(true);
    setFormError("");
    try {
      const created = await createOrder(payload);
      setShowForm(false);
      setSelected(created);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "No se pudo crear.");
    } finally {
      setSaving(false);
    }
  }

  async function setStatus(order: OrderRecord, status: OrderStatus) {
    setDetailBusy(true);
    try {
      const updated = await updateOrder(order.id, { status });
      setSelected(updated);
    } catch (err) {
      alert(err instanceof Error ? err.message : "No se pudo actualizar.");
    } finally {
      setDetailBusy(false);
    }
  }

  function openEditItems() {
    if (!selectedLive) return;
    setEditLines(orderToDraftLines(orderDisplayItems(selectedLive)));
    setShowEditItems(true);
  }

  async function saveEditedItems() {
    if (!selectedLive || editLines.length === 0) return;
    setDetailBusy(true);
    try {
      const updated = await updateOrder(selectedLive.id, {
        items: draftToOrderLines(editLines),
      });
      setSelected(updated);
      setShowEditItems(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : "No se pudieron guardar las líneas.");
    } finally {
      setDetailBusy(false);
    }
  }

  async function submitDeposit(amountOverride?: number) {
    const order = selectedLive ?? selected;
    if (!order) return;
    const amount =
      amountOverride ??
      parseFloat(depositAmount.replace(",", "."));
    if (!Number.isFinite(amount) || amount <= 0) {
      alert("Monto de abono inválido.");
      return;
    }
    setDetailBusy(true);
    try {
      const updated = await addOrderDeposit(order.id, amount);
      setSelected(updated);
      setDepositAmount("");
    } catch (err) {
      alert(err instanceof Error ? err.message : "No se pudo registrar abono.");
    } finally {
      setDetailBusy(false);
    }
  }

  async function markOrderFullyPaid() {
    const order = selectedLive ?? selected;
    if (!order) return;
    const saldo = orderBalance(order);
    if (saldo <= 0) return;
    await submitDeposit(saldo);
  }

  return (
    <div className={styles.ordersPage}>
      <header className={styles.clientsHeader}>
        <div>
          <h1 className={ui.pageTitle}>Pedidos</h1>
          <p className={ui.pageDesc}>
            {mongo
              ? `Encargos y abonos. ${openOrders} activo${openOrders === 1 ? "" : "s"}.`
              : "Requiere MongoDB para registrar pedidos."}
          </p>
        </div>
        <button
          type="button"
          className={`${ui.btn} ${ui.btnPrimary}`}
          disabled={!mongo}
          onClick={openCreate}
        >
          Nuevo pedido
        </button>
      </header>

      {!mongo ? (
        <div className={styles.salesEmpty}>
          <p>Activa la API en Ajustes para usar pedidos.</p>
        </div>
      ) : (
        <>
          <div className={styles.ordersFilters}>
            <input
              className={ui.input}
              placeholder="Buscar folio, cliente o título…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <div className={styles.chips} role="tablist" aria-label="Estado">
              {ORDER_STATUS_FILTERS.map((f) => (
                <button
                  key={f}
                  type="button"
                  role="tab"
                  aria-selected={statusFilter === f}
                  className={`${styles.chip} ${STATUS_FILTER_CHIP_CLASS[f]} ${statusFilter === f ? styles.chipActive : ""} ${statusFilter === f ? styles.orderFilterChipActive : ""}`}
                  onClick={() => setStatusFilter(f)}
                >
                  {orderStatusFilterLabel(f)}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.ordersLayout}>
            <ul className={styles.ordersList}>
              {filtered.length === 0 ? (
                <li className={styles.ordersEmpty}>
                  No hay pedidos con estos filtros.
                </li>
              ) : (
                filtered.map((o) => (
                  <li key={o.id}>
                    <button
                      type="button"
                      className={`${styles.orderRow} ${selected?.id === o.id ? styles.orderRowActive : ""}`}
                      onClick={() => setSelected(o)}
                    >
                      <div className={styles.orderRowTop}>
                        <span className={styles.orderCode}>{o.orderCode}</span>
                        <span
                          className={`${styles.orderStatusBadge} ${STATUS_BADGE_CLASS[o.status]}`}
                        >
                          {ORDER_STATUS_LABELS[o.status]}
                        </span>
                      </div>
                      <div className={styles.orderRowTitle}>
                        {orderSummary(o)}
                      </div>
                      <div className={styles.orderRowMeta}>
                        <span>{o.clientName}</span>
                      </div>
                      <div className={styles.orderRowMoney}>
                        {o.depositPaid > 0 && (
                          <span className={styles.orderRowPaid}>
                            Abonado {formatMoney(o.depositPaid)}
                          </span>
                        )}
                        <span>
                          Saldo {formatMoney(orderBalance(o))} · Total{" "}
                          {formatMoney(o.totalAmount)}
                        </span>
                      </div>
                    </button>
                  </li>
                ))
              )}
            </ul>

            <aside className={styles.orderDetail}>
              {!selectedLive ? (
                <p className={styles.orderDetailPlaceholder}>
                  Selecciona un pedido para ver detalle, abonos y estados.
                </p>
              ) : (
                <>
                  <div className={styles.orderDetailHead}>
                    <h2 className={styles.orderDetailTitle}>
                      {orderSummary(selectedLive)}
                    </h2>
                    <p className={styles.orderDetailSub}>
                      {selectedLive.orderCode}
                    </p>
                    <span
                      className={`${styles.orderStatusBadge} ${styles.orderStatusBadgeLg} ${STATUS_BADGE_CLASS[selectedLive.status]}`}
                    >
                      {ORDER_STATUS_LABELS[selectedLive.status]}
                    </span>
                  </div>

                  <p className={styles.orderDetailClient}>
                    {selectedLive.clientName}
                    {selectedLive.clientPhone
                      ? ` · ${selectedLive.clientPhone}`
                      : ""}
                  </p>

                  <div className={styles.orderDetailSection}>
                    <div className={styles.orderDetailSectionHead}>
                      <h3>Contenido del pedido</h3>
                      {ACTIVE_ORDER_STATUSES.includes(selectedLive.status) && (
                        <button
                          type="button"
                          className={`${ui.btn} ${ui.btnPrimary}`}
                          style={{ padding: "0.35rem 0.65rem", fontSize: "0.78rem" }}
                          disabled={detailBusy}
                          onClick={openEditItems}
                        >
                          Agregar / quitar joyas
                        </button>
                      )}
                    </div>
                    {ACTIVE_ORDER_STATUSES.includes(selectedLive.status) && (
                      <p className={styles.orderEditHint}>
                        Escanea o busca piezas como en punto de venta; quita
                        líneas con × en el editor.
                      </p>
                    )}
                    <OrderItemsTable
                      items={orderDisplayItems(selectedLive)}
                      depositPaid={selectedLive.depositPaid}
                      payments={selectedLive.payments ?? []}
                    />
                  </div>

                  {selectedLive.status === "entregado" && selectedLive.saleId && (
                    <p className={styles.orderSaleLink}>
                      Venta registrada.{" "}
                      <Link to="/ventas">Ver en Ventas →</Link>
                    </p>
                  )}

                  {ACTIVE_ORDER_STATUSES.includes(selectedLive.status) && (
                    <>
                      {(() => {
                        const saldoPendiente = orderBalance(selectedLive);
                        const pedidoPagado = orderIsFullyPaid(selectedLive);
                        const nextStatus =
                          NEXT_STATUS[selectedLive.status];
                        const bloqueaEntrega =
                          nextStatus === "entregado" && !pedidoPagado;

                        return (
                          <>
                      <div className={styles.orderDetailSection}>
                        <h3>Abono</h3>
                        {pedidoPagado ? (
                          <p className={styles.orderPaidBadge}>
                            Pedido pagado
                          </p>
                        ) : (
                          <>
                            <div className={styles.orderDepositRow}>
                              <input
                                type="number"
                                min={0}
                                step="0.01"
                                className={ui.input}
                                placeholder="Monto"
                                value={depositAmount}
                                onChange={(e) =>
                                  setDepositAmount(e.target.value)
                                }
                                disabled={detailBusy}
                              />
                              <button
                                type="button"
                                className={`${ui.btn} ${ui.btnPrimary}`}
                                disabled={detailBusy}
                                onClick={() => void submitDeposit()}
                              >
                                Abonar
                              </button>
                              <button
                                type="button"
                                className={`${ui.btn} ${styles.orderPayFullBtn}`}
                                disabled={detailBusy || saldoPendiente <= 0}
                                onClick={() => void markOrderFullyPaid()}
                                title={`Registrar pago de ${formatMoney(saldoPendiente)}`}
                              >
                                Pedido pagado
                              </button>
                            </div>
                            <p className={styles.orderSaldoHint}>
                              Saldo pendiente:{" "}
                              <strong>{formatMoney(saldoPendiente)}</strong>
                            </p>
                          </>
                        )}
                      </div>

                      <div className={styles.orderDetailSection}>
                        <h3>Estado</h3>
                        {bloqueaEntrega && (
                          <p className={styles.orderDeliverHint}>
                            Completa el pago antes de entregar (usa{" "}
                            <strong>Pedido pagado</strong> o un abono).
                          </p>
                        )}
                        <div className={styles.orderStatusActions}>
                          {nextStatus && (
                            <button
                              type="button"
                              className={`${ui.btn} ${ui.btnPrimary}`}
                              disabled={detailBusy || bloqueaEntrega}
                              onClick={() =>
                                void setStatus(selectedLive, nextStatus)
                              }
                            >
                              →{" "}
                              {ORDER_STATUS_LABELS[nextStatus]}
                            </button>
                          )}
                          <button
                            type="button"
                            className={`${ui.btn} ${ui.btnGhost}`}
                            disabled={
                              detailBusy || selectedLive.status === "cancelado"
                            }
                            onClick={() =>
                              void setStatus(selectedLive, "cancelado")
                            }
                          >
                            Cancelar pedido
                          </button>
                        </div>
                      </div>
                          </>
                        );
                      })()}
                    </>
                  )}
                </>
              )}
            </aside>
          </div>
        </>
      )}

      {showForm && (
        <div
          className={styles.modalOverlay}
          role="dialog"
          aria-modal
          onClick={(e) => e.target === e.currentTarget && !saving && setShowForm(false)}
        >
          <form
            className={`${styles.modal} ${styles.modalWide}`}
            onSubmit={(e) => void onSubmit(e)}
          >
            <h3>Nuevo pedido</h3>
            {formError && (
              <p style={{ color: "var(--danger)", fontSize: "0.9rem" }}>
                {formError}
              </p>
            )}

            <label className={styles.formField}>
              Cliente
              <select
                className={ui.input}
                value={form.clientId ?? ""}
                onChange={(e) => {
                  const id = e.target.value;
                  const c = clients.find((x) => x.id === id);
                  setForm({
                    ...form,
                    clientId: id,
                    clientName: c?.name ?? "",
                    clientPhone: c?.phone ?? "",
                  });
                }}
              >
                <option value="">— Escribir nombre abajo —</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>

            {!form.clientId && (
              <>
                <label className={styles.formField}>
                  Nombre del cliente *
                  <input
                    className={ui.input}
                    value={form.clientName ?? ""}
                    onChange={(e) =>
                      setForm({ ...form, clientName: e.target.value })
                    }
                  />
                </label>
                <label className={styles.formField}>
                  Teléfono
                  <input
                    className={ui.input}
                    value={form.clientPhone ?? ""}
                    onChange={(e) =>
                      setForm({ ...form, clientPhone: e.target.value })
                    }
                  />
                </label>
              </>
            )}

            <OrderLinesEditor
              lines={draftLines}
              onChange={setDraftLines}
              products={products}
              disabled={saving}
            />

            <label className={styles.formField}>
              Dejó hoy (opcional)
              <input
                type="number"
                min={0}
                step="1"
                className={ui.input}
                value={form.dejoHoy}
                onChange={(e) => setForm({ ...form, dejoHoy: e.target.value })}
                placeholder="Anticipo en mostrador"
              />
            </label>
            <div className={styles.modalActions}>
              <button
                type="button"
                className={`${ui.btn} ${ui.btnGhost}`}
                disabled={saving}
                onClick={() => setShowForm(false)}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className={`${ui.btn} ${ui.btnPrimary}`}
                disabled={saving}
              >
                {saving ? "Creando…" : "Crear pedido"}
              </button>
            </div>
          </form>
        </div>
      )}

      {showEditItems && selectedLive && (
        <div
          className={styles.modalOverlay}
          role="dialog"
          aria-modal
          onClick={(e) =>
            e.target === e.currentTarget && !detailBusy && setShowEditItems(false)
          }
        >
          <div className={`${styles.modal} ${styles.modalWide}`}>
            <h3>Agregar o quitar joyas del pedido</h3>
            <p className={styles.orderFormHint}>
              Escanea, confirma con foto, o agrega conceptos. El total y
              mayoreo se recalculan solos.
            </p>
            <OrderLinesEditor
              lines={editLines}
              onChange={setEditLines}
              products={products}
              disabled={detailBusy}
            />
            <div className={styles.modalActions}>
              <button
                type="button"
                className={`${ui.btn} ${ui.btnGhost}`}
                disabled={detailBusy}
                onClick={() => setShowEditItems(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className={`${ui.btn} ${ui.btnPrimary}`}
                disabled={detailBusy || editLines.length === 0}
                onClick={() => void saveEditedItems()}
              >
                {detailBusy ? "Guardando…" : "Guardar cambios"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
