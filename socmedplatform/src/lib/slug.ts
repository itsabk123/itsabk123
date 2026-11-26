import { randomBytes } from "crypto";

export function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "item";
}

export function uniqueSlug(base: string) {
  return `${slugify(base)}-${randomBytes(3).toString("hex")}`;
}
