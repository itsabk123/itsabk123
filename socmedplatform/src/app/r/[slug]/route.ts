import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sha256 } from "@/lib/crypto";

/** Tracked redirect. Counts one click per visitor per hour (IP+UA hashed, never stored raw). */
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const link = await db.trackingLink.findUnique({ where: { slug } });
  if (!link) return NextResponse.redirect(new URL("/", req.url));
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim();
  const ua = req.headers.get("user-agent") ?? "";
  const isBot = /bot|crawl|spider|preview|slurp|facebookexternalhit/i.test(ua);
  const visitorHash = sha256(`${ip}|${ua}|${new Date().toISOString().slice(0, 13)}`).slice(0, 32);
  if (!isBot) {
    const seen = await db.clickEvent.findFirst({ where: { linkId: link.id, visitorHash } });
    if (!seen) {
      await db.$transaction([
        db.clickEvent.create({ data: { linkId: link.id, visitorHash, referrer: req.headers.get("referer")?.slice(0, 300) } }),
        db.trackingLink.update({ where: { id: link.id }, data: { clicks: { increment: 1 } } }),
      ]);
    }
  }
  return NextResponse.redirect(link.destinationUrl, 302);
}
