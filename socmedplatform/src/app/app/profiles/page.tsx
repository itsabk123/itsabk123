import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { accessibleProfiles } from "@/lib/access";
import { Avatar, Empty, Flash, PageHeader } from "@/components/ui";
import { PROFILE_TYPE_META } from "@/lib/taxonomy";

export default async function Profiles({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const user = await requireUser();
  const profiles = await accessibleProfiles(user.id);
  return (
    <div>
      <PageHeader title="My profiles" sub="Every role you operate — owned by you or managed through your organizations." actions={<Link href="/app/onboarding" className="btn-primary">Add a profile</Link>} />
      <Flash sp={sp} />
      {profiles.length ? (
        <div className="grid gap-3">
          {profiles.map((p) => (
            <div key={p.id} className="card flex flex-wrap items-center gap-4 p-4">
              <Avatar src={p.avatarUrl} name={p.displayName} size={44} />
              <div className="min-w-0 flex-1">
                <div className="font-medium text-ink">{p.displayName}</div>
                <div className="text-sm text-muted">{PROFILE_TYPE_META[p.type].label} · {p.status.toLowerCase()} · {p.completeness}% complete{p.ownerUserId !== user.id ? " · managed" : ""}</div>
              </div>
              <div className="h-1.5 w-24 rounded-full bg-paper-deep"><div className="h-1.5 rounded-full bg-ink" style={{ width: `${p.completeness}%` }} /></div>
              <Link href={`/p/${p.slug}`} className="btn-ghost btn-sm">View</Link>
              <Link href={`/app/profiles/${p.id}/edit`} className="btn-secondary btn-sm">Edit</Link>
            </div>
          ))}
        </div>
      ) : <Empty title="No profiles yet" action={<Link href="/app/onboarding" className="btn-primary">Create your first profile</Link>} />}
    </div>
  );
}
