import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { catalogWebApi, ApiError } from "@/lib/api";
import { formatMoney, metalLabel } from "@/lib/format";
import { productDisplayName } from "@/lib/productSize";
import type { PublicCatalogItem, PublicCatalogResponse } from "@/types";
import styles from "./PublicCatalogPage.module.css";

interface Props {
  showPrices: boolean;
}

function itemTitle(item: PublicCatalogItem): string {
  return productDisplayName({ name: item.name, size: item.size });
}

export function PublicCatalogPage({ showPrices }: Props) {
  const { slug = "" } = useParams();
  const [data, setData] = useState<PublicCatalogResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    void catalogWebApi
      .fetchPublic(slug, showPrices)
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((err) => {
        if (!cancelled) {
          setData(null);
          setError(
            err instanceof ApiError
              ? err.message
              : "No se pudo cargar el catálogo."
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug, showPrices]);

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

  if (loading) {
    return (
      <div className={styles.page}>
        <p className={styles.loading}>Cargando catálogo…</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className={styles.page}>
        <p className={styles.error}>{error || "Catálogo no disponible."}</p>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.brand}>{data.title}</h1>
        <p className={styles.sub}>
          {showPrices
            ? "Precios de referencia (menudeo)"
            : "Selección de piezas — consulta precio en tienda"}
        </p>
      </header>

      {data.items.length === 0 ? (
        <p className={styles.empty}>No hay piezas publicadas en este momento.</p>
      ) : (
        byCategory.map(([category, items]) => (
          <section key={category}>
            <h2
              className={styles.sub}
              style={{
                padding: "1rem 1rem 0",
                maxWidth: 1100,
                margin: "0 auto",
                textAlign: "left",
                fontWeight: 600,
                color: "#1a1508",
              }}
            >
              {category}
            </h2>
            <ul className={styles.grid} style={{ listStyle: "none", margin: 0 }}>
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
                    ) : showPrices && item.priceMenudeo != null ? (
                      <div className={styles.price}>
                        {formatMoney(item.priceMenudeo)}
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
        Inventario en tiempo real · Joyerías García
      </footer>
    </div>
  );
}
