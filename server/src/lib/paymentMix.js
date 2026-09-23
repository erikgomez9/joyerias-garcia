export function validatePaymentMix(mix, total) {
  if (!mix || typeof mix !== "object") {
    throw new Error("Indica el desglose del pago mixto.");
  }
  const efectivo = Math.max(0, Number(mix.efectivo) || 0);
  const tarjeta = Math.max(0, Number(mix.tarjeta) || 0);
  const transferencia = Math.max(0, Number(mix.transferencia) || 0);
  const parts = [efectivo, tarjeta, transferencia].filter((n) => n > 0);
  if (parts.length < 2) {
    throw new Error(
      "En pago mixto indica al menos dos montos (ej. efectivo + tarjeta)."
    );
  }
  const sum = efectivo + tarjeta + transferencia;
  if (Math.abs(sum - total) > 0.009) {
    throw new Error("La suma del pago mixto debe igualar el total del ticket.");
  }
  const out = {};
  if (efectivo > 0) out.efectivo = efectivo;
  if (tarjeta > 0) out.tarjeta = tarjeta;
  if (transferencia > 0) out.transferencia = transferencia;
  return out;
}
