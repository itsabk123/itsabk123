"use server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { canActFor } from "@/lib/access";
import { optStr, str, url } from "@/lib/forms";
import { notifyProfile } from "@/lib/notify";

async function load(fd: FormData) {
  const user = await requireUser();
  const b = await db.booking.findUnique({ where: { id: str(fd, "bookingId") } });
  if (!b) redirect("/app/bookings?err=Not+found");
  const isProvider = await canActFor(user.id, b.providerProfileId);
  const isRequester = await canActFor(user.id, b.requesterProfileId);
  if (!isProvider && !isRequester) redirect("/app/bookings?err=Not+authorised");
  const other = isProvider ? b.requesterProfileId : b.providerProfileId;
  return { b, isProvider, other };
}

export async function confirmBooking(fd: FormData) {
  const { b, isProvider, other } = await load(fd);
  if (!isProvider || b.status !== "REQUESTED") redirect("/app/bookings?err=Can%27t+confirm");
  await db.booking.update({ where: { id: b.id }, data: { status: "CONFIRMED", meetingUrl: url(fd, "meetingUrl"), location: optStr(fd, "location", 200) } });
  await notifyProfile(other, "bookings", { title: "Booking confirmed", link: "/app/bookings" });
  redirect("/app/bookings?ok=Confirmed");
}

export async function updateBookingDetails(fd: FormData) {
  const { b, other } = await load(fd);
  await db.booking.update({ where: { id: b.id }, data: { meetingUrl: url(fd, "meetingUrl") ?? b.meetingUrl, location: optStr(fd, "location", 200) ?? b.location } });
  await notifyProfile(other, "bookings", { title: "Booking details updated", link: "/app/bookings" });
  redirect("/app/bookings?ok=Updated");
}

export async function requestReschedule(fd: FormData) {
  const { b, other } = await load(fd);
  const when = new Date(str(fd, "startsAt"));
  if (Number.isNaN(when.getTime()) || when < new Date()) redirect("/app/bookings?err=Choose+a+future+time");
  await db.booking.update({ where: { id: b.id }, data: { status: "RESCHEDULE_REQUESTED", proposedStartsAt: when } });
  await notifyProfile(other, "bookings", { title: "Reschedule requested", link: "/app/bookings" });
  redirect("/app/bookings?ok=Reschedule+requested");
}

export async function acceptReschedule(fd: FormData) {
  const { b, other } = await load(fd);
  if (b.status !== "RESCHEDULE_REQUESTED" || !b.proposedStartsAt) redirect("/app/bookings");
  const dur = b.endsAt.getTime() - b.startsAt.getTime();
  await db.booking.update({ where: { id: b.id }, data: { status: "CONFIRMED", startsAt: b.proposedStartsAt, endsAt: new Date(b.proposedStartsAt.getTime() + dur), proposedStartsAt: null, reminderSentAt: null } });
  await notifyProfile(other, "bookings", { title: "New time confirmed", link: "/app/bookings" });
  redirect("/app/bookings?ok=Rescheduled");
}

export async function cancelBooking(fd: FormData) {
  const { b, other } = await load(fd);
  if (!["REQUESTED", "CONFIRMED", "RESCHEDULE_REQUESTED"].includes(b.status)) redirect("/app/bookings");
  await db.booking.update({ where: { id: b.id }, data: { status: "CANCELLED", notes: [b.notes, optStr(fd, "reason", 300)].filter(Boolean).join("\n") } });
  await notifyProfile(other, "bookings", { title: "Booking cancelled", body: optStr(fd, "reason", 300) ?? undefined, link: "/app/bookings" });
  redirect("/app/bookings?ok=Cancelled");
}

export async function completeBooking(fd: FormData) {
  const { b } = await load(fd);
  if (b.status !== "CONFIRMED" || b.startsAt > new Date()) redirect("/app/bookings?err=Only+past+confirmed+bookings+can+be+completed");
  await db.booking.update({ where: { id: b.id }, data: { status: "COMPLETED" } });
  redirect("/app/bookings?ok=Marked+complete");
}
