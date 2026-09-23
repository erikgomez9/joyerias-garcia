import { NavLink, Outlet } from "react-router-dom";
import { usePos } from "@/context/PosContext";
import styles from "./AppLayout.module.css";

const nav = [
  { to: "/dashboard", label: "Panel", icon: "◇" },
  { to: "/pos", label: "Punto de venta", icon: "◆" },
  { to: "/catalogo", label: "Inventario", icon: "○" },
  { to: "/pedidos", label: "Pedidos", icon: "▷" },
  { to: "/clientes", label: "Clientes", icon: "◎" },
  { to: "/ventas", label: "Ventas", icon: "▤" },
  { to: "/garantias", label: "Garantías", icon: "↺" },
  { to: "/danos", label: "Daños", icon: "✕" },
  { to: "/reportes", label: "Reportes", icon: "◈" },
  { to: "/ajustes", label: "Ajustes", icon: "⚙" },
];

export function AppLayout() {
  const { inventorySource } = usePos();
  const pillLabel =
    inventorySource === "loading"
      ? "Conectando…"
      : inventorySource === "mongo"
        ? "MongoDB conectado"
        : "Modo local";

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <span className={styles.brandMark} aria-hidden />
          <div>
            <div className={styles.brandTitle}>Joyería App</div>
            <div className={styles.brandSub}>García · POS</div>
          </div>
        </div>
        <nav className={styles.nav} aria-label="Principal">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `${styles.navLink} ${isActive ? styles.navLinkActive : ""}`
              }
            >
              <span className={styles.navIcon}>{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className={styles.sidebarFoot}>
          <span className={styles.pill}>{pillLabel}</span>
        </div>
      </aside>
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}
