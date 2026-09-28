import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ImageLightbox } from "@/components/ImageLightbox";
import { catalogWebApi, ApiError } from "@/lib/api";
import { formatDate, formatMoney } from "@/lib/format";
import {
  catalogAccessibleTitle,
  catalogItemName,
  catalogSizeDisplay,
} from "@/lib/productSize";
import type { LightboxSlideDirection } from "@/components/ImageLightbox";
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

function itemAccessibleTitle(item: PublicCatalogItem): string {
  return catalogAccessibleTitle({
    name: item.name,
    size: item.size,
    category: item.category,
  });
}

function CatalogBrand({
  title,
  tagline,
  compact,
}: {
  title: string;
  tagline: string;
  compact?: boolean;
}) {
  return (
    <div
      className={
        compact ? styles.brandBlockCompact : styles.brandBlock
      }
    >
      <span
        className={compact ? styles.brandMarkSmall : styles.brandMark}
        aria-hidden
      />
      <div className={styles.brandText}>
        {compact ? (
          <p className={styles.brandTitleCompact}>{title}</p>
        ) : (
          <h1 className={styles.brandTitle}>{title}</h1>
        )}
        <p className={compact ? styles.brandSubCompact : styles.brandSub}>
          {tagline}
        </p>
      </div>
    </div>
  );
}

function CatalogSizeBadge({ item }: { item: PublicCatalogItem }) {
  const size = catalogSizeDisplay(item.category, item.size);
  if (!size) return null;
  return (
    <p className={styles.sizeBadge} aria-label={`${size.label} ${size.value}`}>
      <span className={styles.sizeBadgeLabel}>{size.label}</span>
      <span className={styles.sizeBadgeValue}>{size.value}</span>
    </p>
  );
}

function catalogNotesText(item: PublicCatalogItem): string | null {
  const n = item.notes?.trim();
  return n || null;
}

function CatalogNotesBadge({ item }: { item: PublicCatalogItem }) {
  const notes = catalogNotesText(item);
  if (!notes) return null;
  return (
    <p className={styles.notesBadge} aria-label={`Notas ${notes}`}>
      <span className={styles.notesBadgeLabel}>Notas</span>
      <span className={styles.notesBadgeValue}>{notes}</span>
    </p>
  );
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
  storeTitle,
}: {
  item: PublicCatalogItem;
  showPrices: boolean;
  storeTitle: string;
}) {
  return (
    <div className={styles.zoomFooter}>
      <p className={styles.zoomStoreLine}>{storeTitle}</p>
      <p className={styles.zoomTitle}>{catalogItemName(item)}</p>
      <CatalogNotesBadge item={item} />
      <CatalogSizeBadge item={item} />
      <p className={styles.zoomMeta}>
        {item.category}
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
  storeTitle,
  showPrices,
  onZoom,
}: {
  item: PublicCatalogItem;
  storeTitle: string;
  showPrices: boolean;
  onZoom: (item: PublicCatalogItem) => void;
}) {
  const notes = catalogNotesText(item);
  const notesPill =
    notes && notes.length > 28 ? `${notes.slice(0, 27)}…` : notes;
  return (
    <li
      className={`${styles.card} ${item.soldOut ? styles.cardSoldOut : ""}`}
    >
      <button
        type="button"
        className={styles.imageWrap}
        aria-label={`Ampliar foto de ${itemAccessibleTitle(item)}`}
        onClick={() => onZoom(item)}
      >
        <img src={item.image} alt="" loading="lazy" />
        <span className={styles.cardStoreMark} aria-hidden>
          {storeTitle}
        </span>
        {notesPill ? (
          <span className={styles.cardNotesPill} aria-hidden>
            {notesPill}
          </span>
        ) : null}
        <span className={styles.zoomBtn} aria-hidden>
          <ZoomIcon />
        </span>
      </button>
      <div className={styles.body}>
        <p className={styles.name}>{catalogItemName(item)}</p>
        <CatalogNotesBadge item={item} />
        <CatalogSizeBadge item={item} />
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
  storeTitle,
  showPrices,
  onZoom,
}: {
  block: MaterialCatalogBlock;
  storeTitle: string;
  showPrices: boolean;
  onZoom: (item: PublicCatalogItem) => void;
}) {
  const [activeCategory, setActiveCategory] = useState<string>("all");

  const visibleCategories = useMemo(() => {
    if (activeCategory === "all") return block.categories;
    return block.categories.filter((c) => c.category === activeCategory);
  }, [block.categories, activeCategory]);

  function scrollToCategory(category: string) {
    window.requestAnimationFrame(() => {
      document
        .getElementById(categoryAnchorId(block.material, category))
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function selectCategory(next: string) {
    setActiveCategory(next);
    if (next !== "all") scrollToCategory(next);
  }

  const categoryNav =
    block.categories.length > 0 ? (
      <nav
        className={styles.materialCategoryNav}
        aria-label={`Categorías en catálogo ${block.material}`}
      >
        <div className={styles.materialCategoryChips} role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeCategory === "all"}
            className={`${styles.chip} ${activeCategory === "all" ? styles.chipActive : ""}`}
            onClick={() => selectCategory("all")}
          >
            Todas
          </button>
          {block.categories.map(({ category, items }) => (
            <button
              key={category}
              type="button"
              role="tab"
              aria-selected={activeCategory === category}
              className={`${styles.chip} ${activeCategory === category ? styles.chipActive : ""}`}
              onClick={() => selectCategory(category)}
            >
              {category}
              <span className={styles.chipCount} aria-hidden>
                {items.length}
              </span>
            </button>
          ))}
        </div>
      </nav>
    ) : null;

  return (
    <article
      id={materialAnchorId(block.material)}
      className={styles.materialCatalog}
      aria-labelledby={`catalog-${materialAnchorId(block.material)}`}
    >
      <header className={styles.materialCatalogHead}>
        <CatalogBrand
          compact
          title={storeTitle}
          tagline={`Catálogo · ${block.material}`}
        />
        <h2
          id={`catalog-${materialAnchorId(block.material)}`}
          className={styles.materialCatalogTitle}
        >
          {block.material}
        </h2>
        <p className={styles.materialCatalogMeta}>
          {block.itemCount} pieza{block.itemCount === 1 ? "" : "s"} ·{" "}
          {block.categories.length} categoría
          {block.categories.length === 1 ? "" : "s"}
        </p>
        {categoryNav}
      </header>

      {visibleCategories.map(({ category, items }) => (
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
                storeTitle={storeTitle}
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
  const [zoomSlideDir, setZoomSlideDir] =
    useState<LightboxSlideDirection>("next");

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
    if (!data?.title) return;
    const suffix = showPrices ? " · Con precios" : " · Catálogo";
    document.title = `${data.title}${suffix}`;
    return () => {
      document.title = "Joyería App";
    };
  }, [data?.title, showPrices]);

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
    setZoomSlideDir("next");
    setZoomIndex(i >= 0 ? i : null);
  }

  function closeZoom() {
    setZoomIndex(null);
  }

  function goPrev() {
    setZoomSlideDir("prev");
    setZoomIndex((i) => {
      if (i == null || i <= 0) return i;
      return i - 1;
    });
  }

  function goNext() {
    setZoomSlideDir("next");
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
        <CatalogBrand
          title={data.title}
          tagline={
            showPrices
              ? "García · Vitrina con precios"
              : "García · Vitrina · consulta en tienda"
          }
        />
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
              storeTitle={data.title}
              showPrices={showPrices}
              onZoom={openZoom}
            />
          ))
        )}
      </main>

      <footer className={styles.footer}>
        <CatalogBrand
          compact
          title={data.title}
          tagline="Se actualiza cada 30 s"
        />
      </footer>

      <ImageLightbox
        open={zoomItem != null}
        src={zoomItem?.image ?? ""}
        alt={zoomItem ? itemAccessibleTitle(zoomItem) : ""}
        mediaKey={zoomItem?.id}
        slideDirection={zoomSlideDir}
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
            <ZoomFooter
              item={zoomItem}
              showPrices={showPrices}
              storeTitle={data.title}
            />
          ) : undefined
        }
      />
    </div>
  );
}
