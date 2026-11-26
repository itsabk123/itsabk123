import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { Avatar, Empty, Flash, PageHeader } from "@/components/ui";
import { formatDate } from "@/lib/time";
import { deleteSearch, moveSaved, toggleSave, toggleSearchAlert } from "./actions";

export default async function Saved({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const user = await requireUser();
  const [saved, searches] = await Promise.all([
    db.savedProfile.findMany({ where: { userId: user.id }, include: { profile: true }, orderBy: { createdAt: "desc" } }),
    db.savedSearch.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } }),
  ]);
  const lists = [...new Set(saved.map((s) => s.listName))];
  return (
    <div>
      <PageHeader title="Saved" sub="Shortlists and saved searches. Searches with alerts on email you when new matching profiles or campaigns appear (at most daily)." />
      <Flash sp={sp} />
      <section className="mb-10">
        <h2 className="h3 mb-3">Shortlists</h2>
        {saved.length ? lists.map((l) => (
          <div key={l} className="mb-6">
            <div className="stat-label mb-2">{l}</div>
            <div className="grid gap-2 md:grid-cols-2">
              {saved.filter((s) => s.listName === l).map((s) => (
                <div key={s.id} className="card flex items-center gap-3 p-3">
                  <Avatar src={s.profile.avatarUrl} name={s.profile.displayName} size={36} />
                  <div className="min-w-0 flex-1"><Link href={`/p/${s.profile.slug}`} className="link text-sm font-medium">{s.profile.displayName}</Link><div className="text-xs text-muted">{s.profile.type.toLowerCase()}</div></div>
                  <form action={moveSaved} className="hidden gap-1 sm:flex"><input type="hidden" name="id" value={s.id} /><input name="listName" defaultValue={s.listName} className="input !min-h-[30px] !w-28 !py-0 text-xs" aria-label="List" /><button className="btn-ghost btn-sm">Move</button></form>
                  <Link href={`/app/deals/new?to=${s.profileId}`} className="btn-secondary btn-sm">Propose</Link>
                  <form action={toggleSave}><input type="hidden" name="profileId" value={s.profileId} /><input type="hidden" name="back" value="/app/saved" /><button className="text-xs text-muted underline">Remove</button></form>
                </div>
              ))}
            </div>
          </div>
        )) : <Empty title="No saved profiles" body="Save profiles from their page to build shortlists." />}
      </section>
      <section>
        <h2 className="h3 mb-3">Saved searches</h2>
        {searches.length ? (
          <div className="card divide-y divide-line text-sm">
            {searches.map((s) => (
              <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <div><Link href={s.scope === "campaigns" ? `/campaigns?${s.query}` : `/discover/${s.scope}?${s.query}`} className="link">{s.name}</Link><div className="text-xs text-muted">{s.scope} · saved {formatDate(s.createdAt)}{s.lastAlertAt ? ` · last alert ${formatDate(s.lastAlertAt)}` : ""}</div></div>
                <div className="flex gap-2">
                  <form action={toggleSearchAlert}><input type="hidden" name="id" value={s.id} /><button className="btn-ghost btn-sm">{s.alert ? "Alerts on" : "Alerts off"}</button></form>
                  <form action={deleteSearch}><input type="hidden" name="id" value={s.id} /><button className="btn-ghost btn-sm">Delete</button></form>
                </div>
              </div>
            ))}
          </div>
        ) : <Empty title="No saved searches" body="Use “Save search” on any Discover page." />}
      </section>
    </div>
  );
}
