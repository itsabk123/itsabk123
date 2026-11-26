import { db } from "./db";

/**
 * Fixed-window rate limiter backed by Postgres so it holds across serverless instances.
 * Returns true when the action is allowed.
 */
export async function rateLimit(key: string, limit: number, windowSec: number): Promise<boolean> {
  const now = new Date();
  const windowStart = new Date(now.getTime() - windowSec * 1000);
  const bucket = await db.rateLimitBucket.findUnique({ where: { key } });
  if (!bucket || bucket.windowStart < windowStart) {
    await db.rateLimitBucket.upsert({ where: { key }, create: { key, count: 1, windowStart: now }, update: { count: 1, windowStart: now } });
    return true;
  }
  if (bucket.count >= limit) return false;
  await db.rateLimitBucket.update({ where: { key }, data: { count: { increment: 1 } } });
  return true;
}
