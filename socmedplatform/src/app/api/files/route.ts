import { NextResponse } from "next/server";
import { getFile, verifySignedUrl } from "@/lib/storage";
import { db } from "@/lib/db";

export async function GET(req: Request) {
  const u = new URL(req.url);
  const key = u.searchParams.get("key") ?? "";
  if (!verifySignedUrl(key, u.searchParams.get("exp") ?? "", u.searchParams.get("sig") ?? "")) return new NextResponse("Link expired", { status: 403 });
  const doc = await db.verificationDocument.findFirst({ where: { storageKey: key } });
  if (!doc) return new NextResponse("Not found", { status: 404 });
  const buf = await getFile(key);
  return new NextResponse(new Uint8Array(buf), {
    headers: { "Content-Type": doc.mimeType, "Content-Disposition": `inline; filename="${doc.fileName.replace(/[^\w.-]/g, "_")}"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
  });
}
