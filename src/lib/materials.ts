import type { Metal } from "@/types";

export const METAL_OPTIONS: { value: Metal; label: string }[] = [
  { value: "plata", label: "Plata" },
  { value: "oro", label: "Oro" },
  { value: "acero", label: "Acero" },
  { value: "rodio", label: "Rodio" },
  { value: "oro_laminado", label: "Oro laminado" },
  { value: "otro", label: "Otro material" },
];

const METAL_LABELS: Record<Metal, string> = {
  plata: "Plata",
  oro: "Oro",
  acero: "Acero",
  rodio: "Rodio",
  oro_laminado: "Oro laminado",
  otro: "Otro material",
};

/** Compatibilidad con registros antiguos */
const LEGACY_METAL: Record<string, { metal: Metal; metalOther?: string }> = {
  oro_18k: { metal: "oro" },
  oro_14k: { metal: "oro" },
  platino: { metal: "otro", metalOther: "Platino" },
};

export function materialLabel(
  metal?: Metal | string,
  metalOther?: string
): string {
  if (!metal) return "—";
  if (metal === "otro") return metalOther?.trim() || METAL_LABELS.otro;
  if (metal in METAL_LABELS) return METAL_LABELS[metal as Metal];
  if (metal in LEGACY_METAL) {
    const mapped = LEGACY_METAL[metal]!;
    return materialLabel(mapped.metal, mapped.metalOther);
  }
  return String(metal);
}

export function normalizeMetalFields(
  metal?: string,
  metalOther?: string
): { metal?: Metal; metalOther?: string } {
  if (!metal) return {};
  if (metal in LEGACY_METAL) {
    const mapped = LEGACY_METAL[metal]!;
    return {
      metal: mapped.metal,
      metalOther: mapped.metalOther ?? metalOther,
    };
  }
  if (metal in METAL_LABELS) {
    return {
      metal: metal as Metal,
      metalOther: metal === "otro" ? metalOther?.trim() || undefined : undefined,
    };
  }
  return {
    metal: "otro",
    metalOther: metalOther?.trim() || metal,
  };
}
