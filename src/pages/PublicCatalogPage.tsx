import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { ImageLightbox } from "@/components/ImageLightbox";
import { catalogWebApi, ApiError } from "@/lib/api";
import { formatDate, formatMoney, metalLabel } from "@/lib/format";
import { productDisplayName } from "@/lib/productSize";
import {
  groupCatalogByMaterial,
  materialAnchorId,
} from "@/lib/webCatalogGrouping";
import type { PublicCatalogItem, PublicCatalogResponse } from "@/types";
import styles from "./PublicCatalogPage.module.css";

interface Props {
  showPrices: boolean;
}

const AUTO_REFRESH_MS = 30_000;

function itemTitle(item: PublicCatalogItem): string {
  return productDisplayName({ name: item.name, size: item.size });
}

function ZoomIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" strokeWidth="2" />
      <path
        d="M15.5 15.5L20 20"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M10.5 7.5v6M7.5 10.5h6"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ZoomFooter({
  item,
  showPrices,
}: {
  item: PublicCatalogItem;
  showPrices: boolean;
}) {
  return (
    <div className={styles.zoomFooter}>
      <p className={styles.zoomTitle}>{itemTitle(item)}</p>
      <p className={styles.zoomMeta}>
        {item.category}
        {item.metal ? ` · ${metalLabel(item.metal, item.metalOther)}` : ""}
        {item.stones ? ` · ${item.stones}` : ""}
      </p>
      {item.soldOut ? (
        <span className={styles.badgeSoldOut} role="status">
          {item.soldOutLabel ?? "Agotada — no disponible"}
        </span>
      ) : null}
      {showPrices &&
      (item.priceMayoreo != null || item.priceMenudeo != null) ? (
        <div className={styles.zoomPrices}>
          {item.priceMayoreo != null ? (
            <div className={styles.priceRow}>
              <span>Mayoreo</span>
              <strong>{formatMoney(item.priceMayoreo)}</strong>
            </div>
          ) : null}
          {item.priceMenudeo != null ? (
            <div className={styles.priceRow}>
              <span>Menudeo</span>
              <strong className={styles.priceMenudeo}>
                {formatMoney(item.priceMenudeo)}
              </strong>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function PublicCatalogPage({ showPrices }: Props) {
  const { slug = "" } = useParams();
  const [data, setData] = useState<PublicCatalogResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeMaterial, setActiveMaterial] = useState<string>("all");
  const [zoomItem, setZoomItem] = useState<PublicCatalogItem | null>(null);

  const load = useCallback(
    async (silent = false) => {
      if (!slug.trim()) {
        setError("Enlace de catálogo inválido.");
        setLoading(false);
        return;
      }
      if (!silent) setLoading(true);
      else setRefreshing(true);
      setError("");
      try {
        const res = await catalogWebApi.fetchPublic(slug, showPrices);
        setData(res);
      } catch (err) {
        setData(null);
        setError(
          err instanceof ApiError
            ? err.message
            : "No se pudo cargar el catálogo."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [slug, showPrices]
  );

  useEffect(() => {
    void load(false);
  }, [load]);

  useEffect(() => {
    const timer = window.setInterval(() => void load(true), AUTO_REFRESH_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void load(true);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);

  const byMaterial = useMemo(
    () => (data ? groupCatalogByMaterial(data.items) : []),
    [data]
  );

  const materials = useMemo(
    () => byMaterial.map(([name]) => name),
    [byMaterial]
  );

  function scrollToMaterial(material: string) {
    setActiveMaterial(material);
    if (material === "all") {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    window.requestAnimationFrame(() => {
      document
        .getElementById(materialAnchorId(material))
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  if (loading && !data) {
    return (
      <div className={styles.page}>
        <p className={styles.loading}>Cargando catálogo…</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className={styles.page}>
        <p className={styles.error}>{error}</p>
        <p className={styles.errorHint}>
          Si acabas de subir joyas en la app, confirma en Ajustes que diga{" "}
          <strong>Conectado a MongoDB</strong> (no modo local). En Vercel debe
          existir <code>VITE_API_BASE</code> apuntando a tu API en Render.
        </p>
        <button
          type="button"
          className={styles.refreshBtn}
          onClick={() => void load(false)}
        >
          Reintentar
        </button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className={styles.page}>
        <p className={styles.error}>Catálogo no disponible.</p>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.brand}>{data.title}</h1>
        <p className={styles.sub}>
          {showPrices
            ? "Por material · mayoreo y menudeo · inventario en tiempo real"
            : "Por material · todo el inventario · consulta en tienda"}
        </p>
        <div className={styles.syncBar}>
          <span>
            {data.items.length} pieza{data.items.length === 1 ? "" : "s"} ·
            actualizado {formatDate(data.updatedAt)}
          </span>
          <button
            type="button"
            className={styles.refreshBtn}
            disabled={refreshing}
            onClick={() => void load(true)}
          >
            {refreshing ? "Actualizando…" : "Actualizar"}
          </button>
        </div>
      </header>

      {materials.length > 0 && (
        <nav className={styles.categoryNav} aria-label="Materiales">
          <div className={styles.chips} role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={activeMaterial === "all"}
              className={`${styles.chip} ${activeMaterial === "all" ? styles.chipActive : ""}`}
              onClick={() => scrollToMaterial("all")}
            >
              Todos
            </button>
            {materials.map((mat) => (
              <button
                key={mat}
                type="button"
                role="tab"
                aria-selected={activeMaterial === mat}
                className={`${styles.chip} ${activeMaterial === mat ? styles.chipActive : ""}`}
                onClick={() => scrollToMaterial(mat)}
              >
                {mat}
              </button>
            ))}
          </div>
        </nav>
      )}

      {error ? <p className={styles.errorBanner}>{error}</p> : null}

      <main className={styles.catalogFlow}>
        {data.items.length === 0 ? (
          <p className={styles.empty}>
            No hay piezas en el inventario enlazado a esta vitrina.
          </p>
        ) : (
          byMaterial.map(([material, items]) => (
            <section
              key={material}
              id={materialAnchorId(material)}
              className={styles.section}
              aria-labelledby={`title-${materialAnchorId(material)}`}
            >
              <h2
                id={`title-${materialAnchorId(material)}`}
                className={styles.categoryTitle}
              >
                {material}
              </h2>
              <ul className={styles.grid}>
                {items.map((item) => (
                  <li
                    key={item.id}
                    className={`${styles.card} ${item.soldOut ? styles.cardSoldOut : ""}`}
                  >
                    <button
                      type="button"
                      className={styles.imageWrap}
                      aria-label={`Ampliar foto de ${itemTitle(item)}`}
                      onClick={() => setZoomItem(item)}
                    >
                      <img src={item.image} alt="" loading="lazy" />
                      <span className={styles.zoomBtn} aria-hidden>
                        <ZoomIcon />
                      </span>
                    </button>
                    <div className={styles.body}>
                      <p className={styles.name}>{itemTitle(item)}</p>
                      <p className={styles.meta}>
                        {item.category}
                        {item.stones ? ` · ${item.stones}` : ""}
                      </p>
                      {item.soldOut ? (
                        <span className={styles.badgeSoldOut} role="status">
                          {item.soldOutLabel ?? "Agotada — no disponible"}
                        </span>
                      ) : null}
                      {showPrices &&
                      (item.priceMayoreo != null ||
                        item.priceMenudeo != null) ? (
                        <div className={styles.prices}>
                          {item.priceMayoreo != null ? (
                            <div className={styles.priceRow}>
                              <span>Mayoreo</span>
                              <strong>{formatMoney(item.priceMayoreo)}</strong>
                            </div>
                          ) : null}
                          {item.priceMenudeo != null ? (
                            <div className={styles.priceRow}>
                              <span>Menudeo</span>
                              <strong className={styles.priceMenudeo}>
                                {formatMoney(item.priceMenudeo)}
                              </strong>
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </main>

      <footer className={styles.footer}>
        Se actualiza solo cada 30 s · Joyerías García
      </footer>

      <ImageLightbox
        open={zoomItem != null}
        src={zoomItem?.image ?? ""}
        alt={zoomItem ? itemTitle(zoomItem) : ""}
        onClose={() => setZoomItem(null)}
        footer={
          zoomItem ? (
            <ZoomFooter item={zoomItem} showPrices={showPrices} />
          ) : undefined
        }
      />
    </div>
  );
}
