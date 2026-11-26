import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { Flash, PageHeader } from "@/components/ui";
import { changeRole, createOrg, grantManagement, inviteMember, removeMember } from "./actions";

export default async function Team({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const user = await requireUser();
  const memberships = await db.organizationMember.findMany({
    where: { userId: user.id },
    include: { organization: { include: { members: { include: { user: { select: { name: true, email: true } } }, orderBy: { createdAt: "asc" } }, profiles: true, managed: true } } },
  });
  const myProfiles = await db.profile.findMany({ where: { ownerUserId: user.id, type: { in: ["PODCAST", "INFLUENCER", "GUEST"] } }, include: { managedByOrg: true } });
  return (
    <div>
      <PageHeader title="Team & organizations" sub="Organizations own brand and agency profiles. Members act within their role; agencies manage creators only with the creator's consent." />
      <Flash sp={sp} />
      <div className="space-y-6">
        {memberships.map(({ organization: o, role }) => {
          const admin = role === "OWNER" || role === "ADMIN";
          return (
            <section key={o.id} className="card-pad space-y-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2"><h2 className="h3 text-lg">{o.name}</h2><span className="text-xs text-muted">{o.type.toLowerCase()} · your role: {role.toLowerCase()} · slug: <code>{o.slug}</code></span></div>
              <div className="text-sm text-muted">Profiles: {o.profiles.map((p) => p.displayName).join(", ") || "none"}{o.managed.length ? ` · Represented talent: ${o.managed.map((p) => p.displayName).join(", ")}` : ""}</div>
              <div className="overflow-x-auto"><table className="table">
                <thead><tr><th>Member</th><th>Role</th><th /></tr></thead>
                <tbody>{o.members.map((m) => (
                  <tr key={m.id}><td>{m.user.name}<div className="text-xs text-muted">{m.user.email}</div></td>
                    <td>{admin ? (
                      <form action={changeRole} className="flex gap-1"><input type="hidden" name="orgId" value={o.id} /><input type="hidden" name="memberId" value={m.id} />
                        <select name="role" defaultValue={m.role} className="input !min-h-[32px] !py-0 text-sm">{["OWNER", "ADMIN", "MANAGER", "MEMBER", "VIEWER"].map((r) => <option key={r} value={r}>{r.toLowerCase()}</option>)}</select><button className="btn-ghost btn-sm">Save</button></form>
                    ) : m.role.toLowerCase()}</td>
                    <td>{admin && m.userId !== user.id && <form action={removeMember}><input type="hidden" name="orgId" value={o.id} /><input type="hidden" name="memberId" value={m.id} /><button className="text-xs text-muted underline">Remove</button></form>}</td></tr>
                ))}</tbody>
              </table></div>
              {admin && (
                <form action={inviteMember} className="flex flex-wrap gap-2">
                  <input type="hidden" name="orgId" value={o.id} />
                  <input name="email" type="email" required className="input flex-1" placeholder="colleague@company.com" />
                  <select name="role" className="input !w-36" defaultValue="MEMBER"><option value="ADMIN">Admin</option><option value="MANAGER">Manager</option><option value="MEMBER">Member</option><option value="VIEWER">Viewer</option></select>
                  <button className="btn-secondary">Invite</button>
                </form>
              )}
              <p className="text-xs text-muted">Owners/admins manage the team. Managers can act for the organization's profiles (send proposals, sign, pay). Members and viewers have read access.</p>
            </section>
          );
        })}
        <form action={createOrg} className="card-pad flex flex-wrap items-end gap-2">
          <div className="flex-1"><label className="label" htmlFor="name">New organization</label><input id="name" name="name" className="input" placeholder="Company or agency name" required /></div>
          <select name="type" className="input !w-40"><option value="BRAND">Brand</option><option value="AGENCY">Agency</option><option value="STUDIO">Podcast studio</option></select>
          <button className="btn-secondary">Create</button>
        </form>
        {myProfiles.length > 0 && (
          <section className="card-pad space-y-3">
            <h2 className="h3">Agency representation</h2>
            <p className="text-sm text-muted">Let an agency manage one of your creator profiles. Enter the agency's organization slug; leave empty to revoke.</p>
            {myProfiles.map((p) => (
              <form key={p.id} action={grantManagement} className="flex flex-wrap items-center gap-2">
                <input type="hidden" name="profileId" value={p.id} />
                <span className="w-48 text-sm">{p.displayName}</span>
                <input name="orgSlug" className="input flex-1" defaultValue={p.managedByOrg?.slug ?? ""} placeholder="agency-slug" />
                <button className="btn-secondary btn-sm">Save</button>
              </form>
            ))}
          </section>
        )}
      </div>
    </div>
  );
}
