import { usePos } from "@/context/PosContext";
import ui from "@/components/ui.module.css";
import styles from "./Pages.module.css";

export function SettingsPage() {
  const { inventorySource, inventoryError, refreshInventory } = usePos();

  return (
    <div>
      <h1 className={ui.pageTitle}>Ajustes</h1>
      <p className={ui.pageDesc}>
        Conexión con la API y MongoDB para inventario en la nube.
      </p>

      <div className={ui.card} style={{ maxWidth: 560, marginBottom: "1rem" }}>
        <h2 className={styles.sectionTitle} style={{ marginTop: 0 }}>
          Base de datos
        </h2>
        <p style={{ margin: "0 0 0.75rem", color: "var(--text-muted)" }}>
          Estado:{" "}
          <strong style={{ color: "var(--gold)" }}>
            {inventorySource === "loading"
              ? "Comprobando…"
              : inventorySource === "mongo"
                ? "Conectado a MongoDB"
                : "Modo local (sin API)"}
          </strong>
        </p>
        {inventoryError && (
          <p style={{ margin: "0 0 0.75rem", color: "var(--danger)", fontSize: "0.9rem" }}>
            {inventoryError}
          </p>
        )}
        <button
          type="button"
          className={`${ui.btn} ${ui.btnPrimary}`}
          onClick={() => void refreshInventory()}
        >
          Reintentar conexión
        </button>
      </div>

      <div className={ui.card} style={{ maxWidth: 560 }}>
        <h2 className={styles.sectionTitle} style={{ marginTop: 0 }}>
          Cómo arrancar la API
        </h2>
        <ol
          style={{
            margin: 0,
            paddingLeft: "1.2rem",
            color: "var(--text-muted)",
            lineHeight: 1.7,
            fontSize: "0.9rem",
          }}
        >
          <li>
            Copia <code style={{ color: "var(--gold)" }}>server/.env.example</code>{" "}
            a <code style={{ color: "var(--gold)" }}>server/.env</code>
          </li>
          <li>
            Pon tu <code style={{ color: "var(--gold)" }}>MONGODB_URI</code> de
            Atlas (solo en el servidor, nunca en el navegador)
          </li>
          <li>
            Un solo comando (recomendado):{" "}
            <code style={{ color: "var(--gold)" }}>npm run dev:all</code>
          </li>
          <li>
            Si hay puertos ocupados:{" "}
            <code style={{ color: "var(--gold)" }}>npm run ports:free</code> y
            vuelve a intentar
          </li>
        </ol>
      </div>
    </div>
  );
}
