import Link from "next/link";
import { db } from "@/lib/db";
import { requireActing } from "@/lib/access";
import { Empty, Flash, PageHeader } from "@/components/ui";
import { formatDateTime } from "@/lib/time";
import { acceptReschedule, cancelBooking, completeBooking, confirmBooking, requestReschedule, updateBookingDetails } from "./actions";

export default async function Bookings({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const { acting, user } = await requireActing();
  const all = await db.booking.findMany({ where: { OR: [{ providerProfileId: acting.id }, { requesterProfileId: acting.id }] }, include: { provider: true, requester: true, offering: true, deal: { select: { id: true, title: true } } }, orderBy: { startsAt: "asc" } });
  const now = new Date();
  const upcoming = all.filter((b) => b.endsAt >= now && b.status !== "CANCELLED");
  const past = all.filter((b) => b.endsAt < now || b.status === "CANCELLED").reverse();
  const tz = user.timezone;
  return (
    <div>
      <PageHeader title="Bookings" sub={`Times shown in your timezone (${tz}). Add any booking to your calendar with the .ics link.`} />
      <Flash sp={sp} />
      <h2 className="h3 mb-3">Upcoming</h2>
      {upcoming.length ? (
        <div className="space-y-3">
          {upcoming.map((b) => {
            const isProvider = b.providerProfileId === acting.id;
            const other = isProvider ? b.requester : b.provider;
            const theyProposed = b.status === "RESCHEDULE_REQUESTED";
            return (
              <div key={b.id} className="card-pad space-y-3 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="font-medium text-ink">{formatDateTime(b.startsAt, tz)}</div>
                    <div className="text-muted">{b.offering?.title ?? "Session"} with <Link href={`/p/${other.slug}`} className="link">{other.displayName}</Link> · {b.mode === "VIRTUAL" ? "virtual" : "in person"}{b.deal && <> · <Link href={`/app/deals/${b.deal.id}`} className="link">deal</Link></>}</div>
                    {b.meetingUrl && <a href={b.meetingUrl} target="_blank" rel="noopener" className="link">Join link</a>}{b.location && <div>{b.location}</div>}
                    {theyProposed && b.proposedStartsAt && <div className="mt-1 text-warn">New time proposed: {formatDateTime(b.proposedStartsAt, tz)}</div>}
                  </div>
                  <span className={b.status === "CONFIRMED" ? "badge-ok" : "badge-warn"}>{b.status.replace("_", " ").toLowerCase()}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {isProvider && b.status === "REQUESTED" && (
                    <form action={confirmBooking} className="flex flex-wrap gap-2"><input type="hidden" name="bookingId" value={b.id} /><input name="meetingUrl" className="input !min-h-[32px] !py-1" placeholder="Meeting link (optional)" /><button className="btn-primary btn-sm">Confirm</button></form>
                  )}
                  {theyProposed && <form action={acceptReschedule}><input type="hidden" name="bookingId" value={b.id} /><button className="btn-primary btn-sm">Accept new time</button></form>}
                  <a href={`/api/bookings/${b.id}/ics`} className="btn-secondary btn-sm">Add to calendar</a>
                  <details><summary className="btn-ghost btn-sm list-none">More</summary>
                    <div className="mt-2 grid gap-2 sm:grid-cols-3">
                      <form action={updateBookingDetails} className="flex gap-1"><input type="hidden" name="bookingId" value={b.id} /><input name="meetingUrl" className="input !min-h-[32px] !py-1" placeholder="Meeting link" defaultValue={b.meetingUrl ?? ""} /><input name="location" className="input !min-h-[32px] !py-1" placeholder="Location" defaultValue={b.location ?? ""} /><button className="btn-secondary btn-sm">Save</button></form>
                      <form action={requestReschedule} className="flex gap-1"><input type="hidden" name="bookingId" value={b.id} /><input name="startsAt" type="datetime-local" className="input !min-h-[32px] !py-1" required /><button className="btn-secondary btn-sm">Propose time</button></form>
                      <form action={cancelBooking} className="flex gap-1"><input type="hidden" name="bookingId" value={b.id} /><input name="reason" className="input !min-h-[32px] !py-1" placeholder="Reason" /><button className="btn-danger btn-sm">Cancel</button></form>
                    </div>
                  </details>
                </div>
              </div>
            );
          })}
        </div>
      ) : <Empty title="No upcoming bookings" body="Bookable packages and guest appearances will show up here." />}
      {past.length > 0 && (
        <>
          <h2 className="h3 mb-3 mt-10">Past & cancelled</h2>
          <div className="card divide-y divide-line text-sm">
            {past.map((b) => (
              <div key={b.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <span>{formatDateTime(b.startsAt, tz)} · {(b.providerProfileId === acting.id ? b.requester : b.provider).displayName}</span>
                <span className="flex items-center gap-2"><span className="badge">{b.status.toLowerCase()}</span>{b.status === "CONFIRMED" && <form action={completeBooking}><input type="hidden" name="bookingId" value={b.id} /><button className="btn-ghost btn-sm">Mark done</button></form>}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
