import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { Flash, PageHeader } from "@/components/ui";
import { formatDate } from "@/lib/time";
import { featureProfile, setUserRole, setUserStatus, verifyProfile } from "../actions";

export default async function Users({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const q = sp.q?.trim();
  const where: Prisma.UserWhereInput = q ? { OR: [{ email: { contains: q, mode: "insensitive" } }, { name: { contains: q, mode: "insensitive" } }, { profiles: { some: { displayName: { contains: q, mode: "insensitive" } } } }] } : {};
  const users = await db.user.findMany({ where: { ...where, status: sp.status === "SUSPENDED" ? "SUSPENDED" : { not: "DELETED" } }, include: { profiles: true, _count: { select: { reports: true } } }, orderBy: { createdAt: "desc" }, take: 50 });
  return (
    <div>
      <PageHeader title="Users & profiles" />
      <Flash sp={sp} />
      <form className="mb-4 flex gap-2"><input name="q" defaultValue={q} className="input" placeholder="Search name, email or profile" /><select name="status" defaultValue={sp.status} className="input !w-40"><option value="">Active</option><option value="SUSPENDED">Suspended</option></select><button className="btn-primary">Search</button></form>
      <div className="space-y-3">
        {users.map((u) => (
          <div key={u.id} className="card-pad space-y-3 text-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div><div className="font-medium text-ink">{u.name} <span className="text-muted">· {u.email}</span></div><div className="text-xs text-muted">Joined {formatDate(u.createdAt)} · last active {formatDate(u.lastActiveAt)} · {u.emailVerifiedAt ? "email verified" : "email unverified"} · role {u.platformRole.toLowerCase()} · {u.status.toLowerCase()}{u.suspendedReason ? ` (${u.suspendedReason})` : ""}</div></div>
              <div className="flex flex-wrap gap-2">
                <form action={setUserStatus} className="flex gap-1"><input type="hidden" name="userId" value={u.id} /><input type="hidden" name="status" value={u.status === "SUSPENDED" ? "ACTIVE" : "SUSPENDED"} />{u.status !== "SUSPENDED" && <input name="reason" className="input !min-h-[32px] !w-40 !py-0 text-xs" placeholder="Reason" required />}<button className={u.status === "SUSPENDED" ? "btn-secondary btn-sm" : "btn-danger btn-sm"}>{u.status === "SUSPENDED" ? "Restore" : "Suspend"}</button></form>
                <form action={setUserRole} className="flex gap-1"><input type="hidden" name="userId" value={u.id} /><select name="role" defaultValue={u.platformRole} className="input !min-h-[32px] !w-32 !py-0 text-xs">{["USER", "MODERATOR", "FINANCE", "ADMIN", "SUPERADMIN"].map((r) => <option key={r}>{r}</option>)}</select><button className="btn-ghost btn-sm">Set role</button></form>
              </div>
            </div>
            {u.profiles.map((p) => (
              <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-paper px-3 py-2">
                <span><Link href={`/p/${p.slug}`} className="link">{p.displayName}</Link> <span className="text-xs text-muted">{p.type.toLowerCase()} · {p.status.toLowerCase()} · {p.completeness}%{p.verifiedAt ? " · verified" : ""}{p.featuredUntil && p.featuredUntil > new Date() ? ` · featured to ${formatDate(p.featuredUntil)}` : ""}{p.isDemo ? " · demo" : ""}</span></span>
                <span className="flex gap-1">
                  <form action={verifyProfile}><input type="hidden" name="profileId" value={p.id} /><input type="hidden" name="back" value="/admin/users" /><input type="hidden" name="verified" value={p.verifiedAt ? "0" : "1"} /><button className="btn-ghost btn-sm">{p.verifiedAt ? "Unverify" : "Verify"}</button></form>
                  <form action={featureProfile} className="flex gap-1"><input type="hidden" name="profileId" value={p.id} /><input name="days" className="input !min-h-[30px] !w-16 !py-0 text-xs" placeholder="days" inputMode="numeric" /><button className="btn-ghost btn-sm">Feature</button></form>
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
