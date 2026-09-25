import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { catalogWebApi, ApiError } from "@/lib/api";
import { formatDate, formatMoney, metalLabel } from "@/lib/format";
import { productDisplayName } from "@/lib/productSize";
import type { PublicCatalogItem, PublicCatalogResponse } from "@/types";
import styles from "./PublicCatalogPage.module.css";

interface Props {
  showPrices: boolean;
}

const AUTO_REFRESH_MS = 30_000;

function itemTitle(item: PublicCatalogItem): string {
  return productDisplayName({ name: item.name, size: item.size });
}

export function PublicCatalogPage({ showPrices }: Props) {
  const { slug = "" } = useParams();
  const [data, setData] = useState<PublicCatalogResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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

  const byCategory = useMemo(() => {
    if (!data) return [];
    const map = new Map<string, PublicCatalogItem[]>();
    for (const item of data.items) {
      const list = map.get(item.category) ?? [];
      list.push(item);
      map.set(item.category, list);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [data]);

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
        <button type="button" className={styles.refreshBtn} onClick={() => void load(false)}>
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
            ? "Precios mayoreo y menudeo · inventario en tiempo real"
            : "Todo el inventario · consulta precio en tienda"}
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

      {error ? <p className={styles.errorBanner}>{error}</p> : null}

      {data.items.length === 0 ? (
        <p className={styles.empty}>
          No hay piezas en el inventario enlazado a esta vitrina. Si acabas de
          dar de alta joyas, revisa que la app esté conectada a MongoDB (no solo
          en este navegador).
        </p>
      ) : (
        byCategory.map(([category, items]) => (
          <section key={category}>
            <h2 className={styles.categoryTitle}>{category}</h2>
            <ul className={styles.grid}>
              {items.map((item) => (
                <li
                  key={item.id}
                  className={`${styles.card} ${item.soldOut ? styles.cardSoldOut : ""}`}
                >
                  <div className={styles.imageWrap}>
                    <img src={item.image} alt={itemTitle(item)} loading="lazy" />
                  </div>
                  <div className={styles.body}>
                    <p className={styles.name}>{itemTitle(item)}</p>
                    <p className={styles.meta}>
                      {item.metal
                        ? metalLabel(item.metal, item.metalOther)
                        : item.category}
                      {item.stones ? ` · ${item.stones}` : ""}
                    </p>
                    {item.soldOut ? (
                      <span className={styles.badgeSoldOut}>
                        {item.soldOutLabel ?? "Agotada"}
                      </span>
                    ) : null}
                    {showPrices &&
                    (item.priceMayoreo != null || item.priceMenudeo != null) ? (
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

      <footer className={styles.footer}>
        Se actualiza solo cada 30 s · Joyerías García
      </footer>
    </div>
  );
}
