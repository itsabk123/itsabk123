import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { canActFor } from "@/lib/access";

const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const esc = (s: string) => s.replace(/[\;,]/g, (m) => `\\${m}`).replace(/\n/g, "\\n");

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Unauthorised", { status: 401 });
  const b = await db.booking.findUnique({ where: { id }, include: { provider: true, requester: true, offering: true } });
  if (!b || !((await canActFor(user.id, b.providerProfileId, false)) || (await canActFor(user.id, b.requesterProfileId, false)))) return new NextResponse("Not found", { status: 404 });
  const title = `${b.offering?.title ?? "Session"}: ${b.provider.displayName} × ${b.requester.displayName}`;
  const ics = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Majlis//Bookings//EN", "BEGIN:VEVENT",
    `UID:${b.id}@majlis`, `DTSTAMP:${fmt(new Date())}`, `DTSTART:${fmt(b.startsAt)}`, `DTEND:${fmt(b.endsAt)}`,
    `SUMMARY:${esc(title)}`, `LOCATION:${esc(b.meetingUrl ?? b.location ?? (b.mode === "VIRTUAL" ? "Online" : "TBC"))}`,
    `DESCRIPTION:${esc(`${process.env.APP_URL ?? ""}/app/bookings`)}`, `STATUS:${b.status === "CONFIRMED" ? "CONFIRMED" : "TENTATIVE"}`,
    "END:VEVENT", "END:VCALENDAR",
  ].join("\r\n");
  return new NextResponse(ics, { headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": `attachment; filename="booking-${b.id}.ics"` } });
}
