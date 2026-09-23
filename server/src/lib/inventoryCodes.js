const CATEGORY_CODE = {
  Anillos: "AN",
  Cadenas: "CD",
  Aretes: "AR",
  Pulseras: "PL",
  Dijes: "DI",
  Relojes: "RE",
  Otros: "OT",
};

export const JEWELRY_CODE_PATTERN = /^[A-Z]{2}\d{3,}$/i;

export function categoryCode(category) {
  return CATEGORY_CODE[category] ?? "OT";
}

function maxSequenceForPrefix(prefix, existing) {
  const code = prefix.toUpperCase();
  let max = 0;
  const reNew = new RegExp(`^${code}(\\d+)$`, "i");
  const reLegacySku = new RegExp(`^JG-${code}-(\\d+)$`, "i");

  for (const p of existing) {
    for (const raw of [p.sku, p.barcode]) {
      if (!raw?.trim()) continue;
      const u = raw.trim().toUpperCase();
      let m = u.match(reNew);
      if (m) {
        const n = Number.parseInt(m[1], 10);
        if (!Number.isNaN(n) && n > max) max = n;
        continue;
      }
      m = u.match(reLegacySku);
      if (m) {
        const n = Number.parseInt(m[1], 10);
        if (!Number.isNaN(n) && n > max) max = n;
      }
    }
  }
  return max;
}

export function generateJewelryCode(category, existing) {
  const prefix = categoryCode(category);
  const next = maxSequenceForPrefix(prefix, existing) + 1;
  return `${prefix}${String(next).padStart(3, "0")}`;
}

export function generateSku(category, existing) {
  return generateJewelryCode(category, existing);
}

export function generateBarcode(category, existing) {
  return generateJewelryCode(category, existing);
}

export function normalizeJewelryCode(raw) {
  return raw.trim().toUpperCase();
}

export function isValidJewelryCode(raw) {
  return JEWELRY_CODE_PATTERN.test(normalizeJewelryCode(raw));
}
