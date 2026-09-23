export function generateOrderCode(existingDocs) {
  let max = 0;
  for (const doc of existingDocs) {
    const code = doc.orderCode ?? "";
    const m = /(\d+)$/.exec(code);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  const next = max + 1;
  return `JG-PD-${String(next).padStart(4, "0")}`;
}
