import "server-only";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { hmac, randomToken, safeEqual } from "./crypto";

/**
 * Private file storage. Local-disk driver for development and single-node deploys; replace with an
 * S3-compatible driver (R2/S3) in production — the interface (put/get/signedUrl) stays the same.
 * Files are never served from /public; access requires a short-lived signed URL issued after an authorization check.
 */
const ROOT = path.resolve(process.env.STORAGE_DIR ?? "./storage");
const ALLOWED: Record<string, string> = { "application/pdf": "pdf", "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

function sniff(buf: Buffer): string | null {
  if (buf.subarray(0, 4).toString() === "%PDF") return "application/pdf";
  if (buf[0] === 0x89 && buf.subarray(1, 4).toString() === "PNG") return "image/png";
  if (buf[0] === 0xff && buf[1] === 0xd8) return "image/jpeg";
  if (buf.subarray(0, 4).toString() === "RIFF" && buf.subarray(8, 12).toString() === "WEBP") return "image/webp";
  return null;
}

export async function putFile(file: File, prefix: string) {
  if (file.size === 0) throw new Error("Empty file");
  if (file.size > MAX_UPLOAD_BYTES) throw new Error("File is larger than 5 MB");
  const buf = Buffer.from(await file.arrayBuffer());
  const mime = sniff(buf); // trust content, not the client-provided type or extension
  if (!mime || !ALLOWED[mime]) throw new Error("Only PDF, PNG, JPG or WEBP files are accepted");
  const key = `${prefix.replace(/[^a-z0-9-]/gi, "")}/${randomToken(16)}.${ALLOWED[mime]}`;
  const full = path.join(ROOT, key);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, buf, { mode: 0o600 });
  // Malware scanning hook: in production enqueue `key` for scanning (e.g. ClamAV) before reviewers open it.
  return { key, mime, size: buf.length, name: file.name.slice(0, 120) };
}

export async function getFile(key: string) {
  const full = path.resolve(ROOT, key);
  if (!full.startsWith(ROOT + path.sep)) throw new Error("Invalid key");
  return readFile(full);
}

export function signedUrl(key: string, ttlSec = 300) {
  const exp = Math.floor(Date.now() / 1000) + ttlSec;
  const sig = hmac(`${key}:${exp}`);
  return `/api/files?key=${encodeURIComponent(key)}&exp=${exp}&sig=${sig}`;
}

export function verifySignedUrl(key: string, exp: string, sig: string) {
  if (!key || !exp || !sig) return false;
  if (Number(exp) < Date.now() / 1000) return false;
  return safeEqual(hmac(`${key}:${exp}`), sig);
}
