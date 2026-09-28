/** Rutas públicas (HashRouter). */
export function publicCatalogPath(
  slug: string,
  withPrices: boolean,
  materialSlug?: string
): string {
  const s = encodeURIComponent(slug.trim());
  const base = withPrices
    ? `/vitrina/${s}`
    : `/vitrina/${s}/sin-precios`;
  if (!materialSlug?.trim()) return base;
  return `${base}/material/${encodeURIComponent(materialSlug.trim())}`;
}

export function publicCatalogAbsoluteUrl(
  slug: string,
  withPrices: boolean,
  materialSlug?: string
): string {
  const path = publicCatalogPath(slug, withPrices, materialSlug);
  const origin =
    typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/#${path}`;
}
