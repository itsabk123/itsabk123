import { db } from "@/lib/db";
import { PageHeader, Stat } from "@/components/ui";
import { formatDateTime } from "@/lib/time";

export default async function Audit({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const [logs, emails, emailStats, health] = await Promise.all([
    db.auditLog.findMany({ where: sp.action ? { action: { startsWith: sp.action } } : {}, include: { actor: { select: { email: true } } }, orderBy: { createdAt: "desc" }, take: 100 }),
    db.emailOutbox.findMany({ orderBy: { createdAt: "desc" }, take: 20 }),
    db.emailOutbox.groupBy({ by: ["status"], _count: true }),
    db.$queryRaw<{ ok: number }[]>`SELECT 1 AS ok`.then(() => "OK").catch(() => "DOWN"),
  ]);
  return (
    <div className="space-y-8">
      <PageHeader title="Audit & system" />
      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Database" value={health} />
        <Stat label="Email provider" value={process.env.RESEND_API_KEY ? "Configured" : "Log only"} note={emailStats.map((e) => `${e.status.toLowerCase()} ${e._count}`).join(" · ")} />
        <Stat label="Payments" value={process.env.PAYMENT_PROVIDER ?? "sandbox"} />
        <Stat label="AI assistant" value={process.env.ANTHROPIC_API_KEY ? "Claude API" : "Templates"} />
      </div>
      <section>
        <form className="mb-3 flex gap-2"><input name="action" defaultValue={sp.action} className="input !w-64" placeholder="Filter by action prefix, e.g. payout" /><button className="btn-secondary">Filter</button></form>
        <div className="card overflow-x-auto"><table className="table">
          <thead><tr><th>When</th><th>Actor</th><th>Action</th><th>Target</th><th>Details</th></tr></thead>
          <tbody>{logs.map((l) => <tr key={l.id}><td className="whitespace-nowrap text-muted">{formatDateTime(l.createdAt)}</td><td>{l.actor?.email ?? "system"}</td><td>{l.action}</td><td className="text-xs">{l.targetType} {l.targetId}</td><td className="max-w-xs truncate text-xs text-muted">{l.meta ? JSON.stringify(l.meta) : ""}</td></tr>)}</tbody>
        </table></div>
      </section>
      <section>
        <h2 className="h3 mb-3">Recent emails</h2>
        <div className="card divide-y divide-line text-sm">{emails.map((e) => <details key={e.id} className="px-4 py-2"><summary className="cursor-pointer">{e.to} · {e.subject} · <span className="text-muted">{e.status.toLowerCase()} · {formatDateTime(e.createdAt)}</span></summary><pre className="mt-2 whitespace-pre-wrap text-xs text-muted">{e.body}</pre></details>)}</div>
      </section>
    </div>
  );
}
