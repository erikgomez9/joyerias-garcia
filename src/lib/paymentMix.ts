import { formatMoney } from "@/lib/format";
import type { PaymentMix } from "@/types";

export function paymentMixTotal(mix: PaymentMix): number {
  return (mix.efectivo ?? 0) + (mix.tarjeta ?? 0) + (mix.transferencia ?? 0);
}

/** null = válido; string = mensaje de error. */
export function validatePaymentMix(mix: PaymentMix, total: number): string | null {
  const efectivo = mix.efectivo ?? 0;
  const tarjeta = mix.tarjeta ?? 0;
  const transferencia = mix.transferencia ?? 0;
  if (efectivo < 0 || tarjeta < 0 || transferencia < 0) {
    return "Los montos no pueden ser negativos.";
  }
  const parts = [efectivo, tarjeta, transferencia].filter((n) => n > 0);
  if (parts.length < 2) {
    return "En pago mixto indica al menos dos montos (ej. efectivo + tarjeta).";
  }
  const sum = efectivo + tarjeta + transferencia;
  if (Math.abs(sum - total) > 0.009) {
    return `La suma (${formatMoney(sum)}) debe igualar el total (${formatMoney(total)}).`;
  }
  return null;
}

export function normalizePaymentMix(mix: PaymentMix): PaymentMix {
  const out: PaymentMix = {};
  if (mix.efectivo != null && mix.efectivo > 0) out.efectivo = mix.efectivo;
  if (mix.tarjeta != null && mix.tarjeta > 0) out.tarjeta = mix.tarjeta;
  if (mix.transferencia != null && mix.transferencia > 0) {
    out.transferencia = mix.transferencia;
  }
  return out;
}

export function formatPaymentMix(mix: PaymentMix): string {
  const bits: string[] = [];
  if (mix.efectivo) bits.push(`Efectivo ${formatMoney(mix.efectivo)}`);
  if (mix.tarjeta) bits.push(`Tarjeta ${formatMoney(mix.tarjeta)}`);
  if (mix.transferencia) {
    bits.push(`Transferencia ${formatMoney(mix.transferencia)}`);
  }
  return bits.join(" · ");
}
