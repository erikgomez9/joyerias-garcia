import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ImageLightbox } from "@/components/ImageLightbox";
import { catalogWebApi, ApiError } from "@/lib/api";
import { formatDate, formatMoney, metalLabel } from "@/lib/format";
import { productDisplayName } from "@/lib/productSize";
import { publicCatalogPath } from "@/lib/webCatalogUrls";
import {
  buildMaterialCatalogs,
  categoryAnchorId,
  materialAnchorId,
  type MaterialCatalogBlock,
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

function CatalogProductCard({
  item,
  showPrices,
  onZoom,
}: {
  item: PublicCatalogItem;
  showPrices: boolean;
  onZoom: (item: PublicCatalogItem) => void;
}) {
  return (
    <li
      className={`${styles.card} ${item.soldOut ? styles.cardSoldOut : ""}`}
    >
      <button
        type="button"
        className={styles.imageWrap}
        aria-label={`Ampliar foto de ${itemTitle(item)}`}
        onClick={() => onZoom(item)}
      >
        <img src={item.image} alt="" loading="lazy" />
        <span className={styles.zoomBtn} aria-hidden>
          <ZoomIcon />
        </span>
      </button>
      <div className={styles.body}>
        <p className={styles.name}>{itemTitle(item)}</p>
        <p className={styles.meta}>
          {item.stones ? item.stones : "\u00a0"}
        </p>
        {item.soldOut ? (
          <span className={styles.badgeSoldOut} role="status">
            {item.soldOutLabel ?? "Agotada — no disponible"}
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
  );
}

function MaterialCatalogSection({
  block,
  showPrices,
  onZoom,
}: {
  block: MaterialCatalogBlock;
  showPrices: boolean;
  onZoom: (item: PublicCatalogItem) => void;
}) {
  return (
    <article
      id={materialAnchorId(block.material)}
      className={styles.materialCatalog}
      aria-labelledby={`catalog-${materialAnchorId(block.material)}`}
    >
      <header className={styles.materialCatalogHead}>
        <h2
          id={`catalog-${materialAnchorId(block.material)}`}
          className={styles.materialCatalogTitle}
        >
          Catálogo · {block.material}
        </h2>
        <p className={styles.materialCatalogMeta}>
          {block.itemCount} pieza{block.itemCount === 1 ? "" : "s"} ·{" "}
          {block.categories.length} categoría
          {block.categories.length === 1 ? "" : "s"}
        </p>
      </header>

      {block.categories.map(({ category, items }) => (
        <section
          key={category}
          id={categoryAnchorId(block.material, category)}
          className={styles.categoryBlock}
          aria-labelledby={`cat-${categoryAnchorId(block.material, category)}`}
        >
          <h3
            id={`cat-${categoryAnchorId(block.material, category)}`}
            className={styles.subCategoryTitle}
          >
            {category}
          </h3>
          <ul className={styles.grid}>
            {items.map((item) => (
              <CatalogProductCard
                key={item.id}
                item={item}
                showPrices={showPrices}
                onZoom={onZoom}
              />
            ))}
          </ul>
        </section>
      ))}
    </article>
  );
}

export function PublicCatalogPage({ showPrices }: Props) {
  const { slug = "", materialSlug: materialSlugParam } = useParams();
  const [data, setData] = useState<PublicCatalogResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeMaterial, setActiveMaterial] = useState<string>("all");
  const [zoomIndex, setZoomIndex] = useState<number | null>(null);

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

  const materialCatalogs = useMemo(
    () =>
      data
        ? buildMaterialCatalogs(data.items, materialSlugParam?.trim())
        : [],
    [data, materialSlugParam]
  );

  const allMaterialCatalogs = useMemo(
    () => (data ? buildMaterialCatalogs(data.items) : []),
    [data]
  );

  const materials = useMemo(
    () => allMaterialCatalogs.map((b) => b.material),
    [allMaterialCatalogs]
  );

  const galleryItems = useMemo(() => {
    const list: PublicCatalogItem[] = [];
    for (const block of materialCatalogs) {
      for (const cat of block.categories) {
        list.push(...cat.items);
      }
    }
    return list;
  }, [materialCatalogs]);

  const zoomItem =
    zoomIndex != null && zoomIndex >= 0 && zoomIndex < galleryItems.length
      ? galleryItems[zoomIndex]!
      : null;

  function openZoom(item: PublicCatalogItem) {
    const i = galleryItems.findIndex((x) => x.id === item.id);
    setZoomIndex(i >= 0 ? i : null);
  }

  function closeZoom() {
    setZoomIndex(null);
  }

  function goPrev() {
    setZoomIndex((i) => {
      if (i == null || i <= 0) return i;
      return i - 1;
    });
  }

  function goNext() {
    setZoomIndex((i) => {
      if (i == null || i >= galleryItems.length - 1) return i;
      return i + 1;
    });
  }

  useEffect(() => {
    if (zoomIndex == null || !data) return;
    if (zoomIndex >= galleryItems.length) {
      setZoomIndex(galleryItems.length > 0 ? galleryItems.length - 1 : null);
      return;
    }
    const id = galleryItems[zoomIndex]?.id;
    if (!id) return;
    const freshIndex = galleryItems.findIndex((x) => x.id === id);
    if (freshIndex >= 0 && freshIndex !== zoomIndex) {
      setZoomIndex(freshIndex);
    }
  }, [data, galleryItems, zoomIndex]);

  useEffect(() => {
    if (materialSlugParam && materialCatalogs[0]) {
      setActiveMaterial(materialCatalogs[0].material);
    }
  }, [materialSlugParam, materialCatalogs]);

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

  const singleMaterial = materialSlugParam && materialCatalogs.length === 1;

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
          <strong>Conectado a MongoDB</strong> (no modo local).
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

  if (materialSlugParam && materialCatalogs.length === 0) {
    return (
      <div className={styles.page}>
        <p className={styles.error}>No hay piezas de este material en inventario.</p>
        <Link
          to={publicCatalogPath(slug, showPrices)}
          className={styles.backCatalogLink}
        >
          Ver todos los catálogos
        </Link>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.brand}>{data.title}</h1>
        <p className={styles.sub}>
          {singleMaterial
            ? `Catálogo ${materialCatalogs[0]!.material}${showPrices ? " · con precios" : " · sin precios"}`
            : "Un catálogo por material · apartados por categoría"}
        </p>
        {singleMaterial ? (
          <Link
            to={publicCatalogPath(slug, showPrices)}
            className={styles.backCatalogLink}
          >
            Ver todos los materiales
          </Link>
        ) : null}
        <div className={styles.syncBar}>
          <span>
            {materialCatalogs.reduce((n, b) => n + b.itemCount, 0)} pieza
            {materialCatalogs.reduce((n, b) => n + b.itemCount, 0) === 1
              ? ""
              : "s"}{" "}
            · actualizado {formatDate(data.updatedAt)}
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

      {!singleMaterial && materials.length > 0 && (
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
            {allMaterialCatalogs.map((block) => (
              <button
                key={block.materialSlug}
                type="button"
                role="tab"
                aria-selected={activeMaterial === block.material}
                className={`${styles.chip} ${activeMaterial === block.material ? styles.chipActive : ""}`}
                onClick={() => scrollToMaterial(block.material)}
              >
                {block.material}
              </button>
            ))}
          </div>
        </nav>
      )}

      {error ? <p className={styles.errorBanner}>{error}</p> : null}

      <main className={styles.catalogFlow}>
        {materialCatalogs.length === 0 ? (
          <p className={styles.empty}>
            No hay piezas en el inventario enlazado a esta vitrina.
          </p>
        ) : (
          materialCatalogs.map((block) => (
            <MaterialCatalogSection
              key={block.materialSlug}
              block={block}
              showPrices={showPrices}
              onZoom={openZoom}
            />
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
        onClose={closeZoom}
        onPrevious={
          zoomIndex != null && zoomIndex > 0 ? goPrev : undefined
        }
        onNext={
          zoomIndex != null && zoomIndex < galleryItems.length - 1
            ? goNext
            : undefined
        }
        navHint={
          zoomIndex != null && galleryItems.length > 1
            ? `${zoomIndex + 1} de ${galleryItems.length} · desliza para cambiar`
            : undefined
        }
        footer={
          zoomItem ? (
            <ZoomFooter item={zoomItem} showPrices={showPrices} />
          ) : undefined
        }
      />
    </div>
  );
}
