import { createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";

export const randomToken = (bytes = 32) => randomBytes(bytes).toString("base64url");
export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

function secret() {
  const s = process.env.APP_SECRET;
  if (!s || s.length < 16) {
    if (process.env.NODE_ENV === "production") throw new Error("APP_SECRET must be set (16+ chars) in production");
    return "dev-only-insecure-secret";
  }
  return s;
}
export const hmac = (payload: string, key = secret()) => createHmac("sha256", key).update(payload).digest("hex");

export function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}
