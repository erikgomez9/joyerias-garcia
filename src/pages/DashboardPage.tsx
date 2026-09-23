import { Link } from "react-router-dom";
import { useMemo } from "react";
import { usePos } from "@/context/PosContext";
import { ACTIVE_ORDER_STATUSES } from "@/lib/orderLabels";
import { isOrderSale, salePaymentLabel } from "@/lib/saleOrigin";
import { formatMoney } from "@/lib/format";
import ui from "@/components/ui.module.css";
import styles from "./Pages.module.css";

export function DashboardPage() {
  const { sales, products, orders, inventorySource } = usePos();

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }, []);

  const stats = useMemo(() => {
    const todaySales = sales.filter((s) => new Date(s.at).getTime() >= today);
    const ventasHoy = todaySales.reduce((a, s) => a + s.total, 0);
    const ticketsHoy = todaySales.length;
    const stockBajo = products.filter((p) => p.stock <= 3).length;
    const totalMes = sales
      .filter((s) => {
        const t = new Date(s.at);
        const n = new Date();
        return t.getMonth() === n.getMonth() && t.getFullYear() === n.getFullYear();
      })
      .reduce((a, s) => a + s.total, 0);
    const pedidosActivos = orders.filter((o) =>
      ACTIVE_ORDER_STATUSES.includes(o.status)
    ).length;
    return { ventasHoy, ticketsHoy, stockBajo, totalMes, pedidosActivos };
  }, [sales, products, orders, today]);

  const recientes = sales.slice(0, 5);

  return (
    <div>
      <h1 className={ui.pageTitle}>Panel</h1>
      <p className={ui.pageDesc}>
        Resumen de la tienda.
        {inventorySource === "mongo"
          ? " Inventario y ventas en MongoDB."
          : inventorySource === "local"
            ? " Datos locales (sin API)."
            : " Cargando…"}
      </p>

      <div className={ui.gridKpi}>
        <div className={ui.card}>
          <div className={ui.cardMuted}>Ventas hoy</div>
          <div className={ui.cardValue}>{formatMoney(stats.ventasHoy)}</div>
        </div>
        <div className={ui.card}>
          <div className={ui.cardMuted}>Tickets hoy</div>
          <div className={ui.cardValue}>{stats.ticketsHoy}</div>
        </div>
        <div className={ui.card}>
          <div className={ui.cardMuted}>Ventas del mes</div>
          <div className={ui.cardValue}>{formatMoney(stats.totalMes)}</div>
        </div>
        <div className={ui.card}>
          <div className={ui.cardMuted}>Piezas con stock bajo</div>
          <div className={ui.cardValue}>{stats.stockBajo}</div>
        </div>
        <div className={ui.card}>
          <div className={ui.cardMuted}>Pedidos activos</div>
          <div className={ui.cardValue}>{stats.pedidosActivos}</div>
        </div>
      </div>

      <div className={styles.rowActions}>
        <Link to="/pos" className={`${ui.btn} ${ui.btnPrimary}`}>
          Abrir punto de venta
        </Link>
        <Link to="/pedidos" className={`${ui.btn} ${ui.btnGhost}`}>
          Ver pedidos
        </Link>
        <Link to="/catalogo" className={`${ui.btn} ${ui.btnGhost}`}>
          Ir a inventario
        </Link>
        <Link to="/reportes" className={`${ui.btn} ${ui.btnGhost}`}>
          Reportes en vivo
        </Link>
      </div>

      <h2 className={styles.sectionTitle}>Últimas ventas</h2>
      {recientes.length === 0 ? (
        <p className={ui.pageDesc}>Aún no hay ventas en esta sesión.</p>
      ) : (
        <div className={ui.tableWrap}>
          <table className={ui.table}>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Total</th>
                <th>Pago</th>
                <th>Artículos</th>
              </tr>
            </thead>
            <tbody>
              {recientes.map((s) => (
                <tr key={s.id}>
                  <td>
                    {new Intl.DateTimeFormat("es-MX", {
                      dateStyle: "short",
                      timeStyle: "short",
                    }).format(new Date(s.at))}
                  </td>
                  <td>{formatMoney(s.total)}</td>
                  <td>
                    <span className={ui.badge}>
                      {isOrderSale(s, orders)
                        ? "Pedido"
                        : salePaymentLabel(s, orders)}
                    </span>
                  </td>
                  <td>{s.items.length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
