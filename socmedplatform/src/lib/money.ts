/** All money is stored as integer fils (1 AED = 100 fils). */
export const toFils = (aed: number) => Math.round(aed * 100);
export const toAed = (fils: number) => fils / 100;

export function formatAed(fils: number | null | undefined, opts: { compact?: boolean } = {}) {
  if (fils === null || fils === undefined) return "—";
  const aed = fils / 100;
  return new Intl.NumberFormat("en-AE", {
    style: "currency",
    currency: "AED",
    maximumFractionDigits: opts.compact || Number.isInteger(aed) ? 0 : 2,
    notation: opts.compact && aed >= 10000 ? "compact" : "standard",
  }).format(aed);
}

export function formatNumber(n: number | null | undefined) {
  if (n === null || n === undefined) return "—";
  return new Intl.NumberFormat("en", { notation: n >= 10000 ? "compact" : "standard", maximumFractionDigits: 1 }).format(n);
}

export function parseAedToFils(v: FormDataEntryValue | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  const s = String(v).replace(/[, ]/g, "").trim();
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) return null;
  return toFils(n);
}
