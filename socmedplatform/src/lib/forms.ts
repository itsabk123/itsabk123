/** Small helpers to read FormData safely in server actions. */
export function str(fd: FormData, key: string, max = 5000): string {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}
export function optStr(fd: FormData, key: string, max = 5000): string | null {
  const s = str(fd, key, max);
  return s ? s : null;
}
export function int(fd: FormData, key: string): number | null {
  const s = str(fd, key).replace(/[, ]/g, "");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n) : null;
}
export function float(fd: FormData, key: string): number | null {
  const s = str(fd, key).replace(/[, %]/g, "");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
export function bool(fd: FormData, key: string): boolean {
  const v = fd.get(key);
  return v === "on" || v === "true" || v === "1";
}
/** Accepts checkbox groups (multiple values) and comma-separated text. */
export function list(fd: FormData, key: string, max = 30): string[] {
  const out: string[] = [];
  for (const v of fd.getAll(key)) {
    if (typeof v !== "string") continue;
    for (const part of v.split(",")) {
      const t = part.trim().slice(0, 80);
      if (t && !out.includes(t)) out.push(t);
    }
  }
  return out.slice(0, max);
}
export function date(fd: FormData, key: string): Date | null {
  const s = str(fd, key);
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}
export function url(fd: FormData, key: string): string | null {
  const s = str(fd, key, 500);
  if (!s) return null;
  try {
    const u = new URL(s.startsWith("http") ? s : `https://${s}`);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    return u.toString();
  } catch {
    return null;
  }
}
