import { NextResponse } from "next/server";
import { runJobs } from "@/lib/jobs";
import { safeEqual } from "@/lib/crypto";

export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  if (!secret || !safeEqual(auth, `Bearer ${secret}`)) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  return NextResponse.json({ ok: true, ran: await runJobs() });
}
export const GET = POST; // Vercel Cron issues GET requests with the Authorization header.
