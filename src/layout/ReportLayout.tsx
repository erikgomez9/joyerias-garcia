import { Link, Outlet } from "react-router-dom";
import styles from "./ReportLayout.module.css";

export function ReportLayout() {
  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <span className={styles.mark} aria-hidden />
          <div>
            <h1 className={styles.title}>Reportes en vivo</h1>
            <p className={styles.sub}>Joyerías García · ventas e inventario</p>
          </div>
        </div>
        <Link to="/dashboard" className={styles.backLink}>
          ← Sistema principal
        </Link>
      </header>
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}
