import { useCallback, useEffect, useState } from "react";
import { usePos } from "@/context/PosContext";
import { apiBaseForDiagnostics, catalogWebApi } from "@/lib/api";
import { buildMaterialCatalogs } from "@/lib/webCatalogGrouping";
import { publicCatalogAbsoluteUrl } from "@/lib/webCatalogUrls";
import { CATALOG_SOLD_OUT_GRACE_DAYS } from "@/lib/webCatalogConstants";
import type { CatalogWebSettings } from "@/types";
import ui from "@/components/ui.module.css";
import styles from "./Pages.module.css";

export function SettingsPage() {
  const { inventorySource, inventoryError, refreshInventory } = usePos();
  const [catalog, setCatalog] = useState<CatalogWebSettings | null>(null);
  const [catalogError, setCatalogError] = useState("");
  const [catalogBusy, setCatalogBusy] = useState(false);
  const [copyMsg, setCopyMsg] = useState("");
  const [materialLinks, setMaterialLinks] = useState<
    { label: string; slug: string }[]
  >([]);

  const loadCatalog = useCallback(async () => {
    if (inventorySource !== "mongo") return;
    setCatalogError("");
    try {
      const s = await catalogWebApi.getSettings();
      setCatalog(s);
    } catch (err) {
      setCatalog(null);
      setCatalogError(
        err instanceof Error ? err.message : "No se pudo cargar el catálogo web."
      );
    }
  }, [inventorySource]);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  useEffect(() => {
    if (!catalog || inventorySource !== "mongo") {
      setMaterialLinks([]);
      return;
    }
    void catalogWebApi
      .fetchPublic(catalog.slug, true)
      .then((res) => {
        const blocks = buildMaterialCatalogs(res.items);
        setMaterialLinks(
          blocks.map((b) => ({ label: b.material, slug: b.materialSlug }))
        );
      })
      .catch(() => setMaterialLinks([]));
  }, [catalog, inventorySource]);

  async function copyText(url: string, okMessage: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopyMsg(okMessage);
      window.setTimeout(() => setCopyMsg(""), 2500);
    } catch {
      setCopyMsg("No se pudo copiar; selecciona el enlace manualmente.");
    }
  }

  async function copyLink(withPrices: boolean) {
    if (!catalog) return;
    const url = publicCatalogAbsoluteUrl(catalog.slug, withPrices);
    await copyText(
      url,
      withPrices ? "Enlace con precios copiado." : "Enlace sin precios copiado."
    );
  }

  async function copyMaterialLink(
    materialSlug: string,
    label: string,
    withPrices: boolean
  ) {
    if (!catalog) return;
    const url = publicCatalogAbsoluteUrl(
      catalog.slug,
      withPrices,
      materialSlug
    );
    await copyText(
      url,
      withPrices
        ? `Catálogo ${label} (con precios) copiado.`
        : `Catálogo ${label} (sin precios) copiado.`
    );
  }

  async function saveCatalogTitle(title: string) {
    if (!catalog) return;
    setCatalogBusy(true);
    try {
      const updated = await catalogWebApi.updateSettings({ title: title.trim() });
      setCatalog(updated);
    } catch (err) {
      setCatalogError(
        err instanceof Error ? err.message : "No se pudo guardar."
      );
    } finally {
      setCatalogBusy(false);
    }
  }

  const linkWithPrices = catalog
    ? publicCatalogAbsoluteUrl(catalog.slug, true)
    : "";
  const linkNoPrices = catalog
    ? publicCatalogAbsoluteUrl(catalog.slug, false)
    : "";

  return (
    <div>
      <h1 className={ui.pageTitle}>Ajustes</h1>
      <p className={ui.pageDesc}>
        Conexión con la API y catálogo web para compartir con clientes.
      </p>

      <div className={ui.card} style={{ maxWidth: 640, marginBottom: "1rem" }}>
        <h2 className={styles.sectionTitle} style={{ marginTop: 0 }}>
          Catálogo web (vitrina)
        </h2>
        <p style={{ margin: "0 0 0.75rem", color: "var(--text-muted)", fontSize: "0.9rem", lineHeight: 1.5 }}>
          Enlace general <strong>con precios</strong> (todos los materiales) o{" "}
          <strong>sin precios</strong>. También puedes compartir un{" "}
          <strong>catálogo por material</strong>; dentro de cada uno las piezas van por{" "}
          <strong>categoría</strong> (Anillos, Cadenas…). Inventario en tiempo real;
          agotadas hasta {CATALOG_SOLD_OUT_GRACE_DAYS} días y luego salen del enlace.
        </p>
        {inventorySource !== "mongo" ? (
          <div
            style={{
              padding: "0.75rem",
              borderRadius: 8,
              background: "rgba(232, 93, 93, 0.12)",
              border: "1px solid var(--danger)",
              marginBottom: "0.75rem",
            }}
          >
            <p style={{ margin: 0, color: "var(--danger)", fontSize: "0.9rem" }}>
              <strong>El catálogo web no verá joyas nuevas</strong> mientras la app
              esté en modo local. Las piezas que das de alta solo quedan en este
              navegador. Conecta la API (MongoDB) y vuelve a registrar inventario,
              o usa la app desplegada con <code>VITE_API_BASE</code> correcto.
            </p>
          </div>
        ) : null}
        {inventorySource === "mongo" ? (
          <p
            style={{
              margin: "0 0 0.75rem",
              fontSize: "0.78rem",
              color: "var(--text-muted)",
            }}
          >
            API en uso: <code>{apiBaseForDiagnostics()}</code>
          </p>
        ) : null}
        {inventorySource !== "mongo" ? (
          <p style={{ color: "var(--text-muted)" }}>
            Conecta MongoDB para activar los enlaces públicos.
          </p>
        ) : catalogError ? (
          <p style={{ color: "var(--danger)" }}>{catalogError}</p>
        ) : catalog ? (
          <>
            <label className={styles.fieldFull} style={{ display: "block", marginBottom: "0.75rem" }}>
              <span className={styles.catalogFiltersLabel}>Título de la vitrina</span>
              <input
                className={ui.input}
                defaultValue={catalog.title}
                disabled={catalogBusy}
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v && v !== catalog.title) void saveCatalogTitle(v);
                }}
              />
            </label>
            <div style={{ marginBottom: "0.75rem" }}>
              <div className={styles.catalogFiltersLabel}>
                Con precios (todos los materiales)
              </div>
              <code
                style={{
                  display: "block",
                  padding: "0.5rem",
                  fontSize: "0.78rem",
                  wordBreak: "break-all",
                  background: "var(--bg-elevated)",
                  borderRadius: 8,
                }}
              >
                {linkWithPrices}
              </code>
              <button
                type="button"
                className={`${ui.btn} ${ui.btnPrimary}`}
                style={{ marginTop: "0.5rem" }}
                onClick={() => void copyLink(true)}
              >
                Copiar enlace con precios
              </button>
            </div>
            {materialLinks.length > 0 ? (
              <div style={{ marginBottom: "0.75rem" }}>
                <div className={styles.catalogFiltersLabel}>
                  Catálogo con precios por material
                </div>
                <ul
                  style={{
                    listStyle: "none",
                    margin: 0,
                    padding: 0,
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.45rem",
                  }}
                >
                  {materialLinks.map((m) => (
                    <li key={m.slug}>
                      <button
                        type="button"
                        className={ui.btn}
                        onClick={() =>
                          void copyMaterialLink(m.slug, m.label, true)
                        }
                      >
                        Copiar · {m.label}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <div style={{ marginBottom: "0.75rem" }}>
              <div className={styles.catalogFiltersLabel}>Sin precios</div>
              <code
                style={{
                  display: "block",
                  padding: "0.5rem",
                  fontSize: "0.78rem",
                  wordBreak: "break-all",
                  background: "var(--bg-elevated)",
                  borderRadius: 8,
                }}
              >
                {linkNoPrices}
              </code>
              <button
                type="button"
                className={ui.btn}
                style={{ marginTop: "0.5rem" }}
                onClick={() => void copyLink(false)}
              >
                Copiar enlace sin precios
              </button>
            </div>
            {materialLinks.length > 0 ? (
              <div style={{ marginBottom: "0.75rem" }}>
                <div className={styles.catalogFiltersLabel}>
                  Catálogo sin precios por material
                </div>
                <ul
                  style={{
                    listStyle: "none",
                    margin: 0,
                    padding: 0,
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.45rem",
                  }}
                >
                  {materialLinks.map((m) => (
                    <li key={`np-${m.slug}`}>
                      <button
                        type="button"
                        className={ui.btn}
                        onClick={() =>
                          void copyMaterialLink(m.slug, m.label, false)
                        }
                      >
                        Copiar sin precios · {m.label}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {copyMsg ? (
              <p style={{ margin: 0, color: "var(--gold)", fontSize: "0.85rem" }}>
                {copyMsg}
              </p>
            ) : null}
            <p style={{ margin: "0.75rem 0 0", fontSize: "0.8rem", color: "var(--text-muted)" }}>
              Cada alta o venta en inventario se refleja al abrir o recargar el enlace.
            </p>
          </>
        ) : (
          <p style={{ color: "var(--text-muted)" }}>Cargando enlaces…</p>
        )}
      </div>

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
