/** Rutas públicas (HashRouter). */
export function publicCatalogPath(slug: string, withPrices: boolean): string {
  const base = `/vitrina/${encodeURIComponent(slug.trim())}`;
  return withPrices ? base : `${base}/sin-precios`;
}

export function publicCatalogAbsoluteUrl(
  slug: string,
  withPrices: boolean
): string {
  const path = publicCatalogPath(slug, withPrices);
  const origin =
    typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/#${path}`;
}
