import { db } from "@/lib/db";
import { PageHeader, Stat } from "@/components/ui";
import { liquidityTable, countBy, type LiquidityRow } from "@/lib/liquidity";
import { languageLabel } from "@/lib/taxonomy";

function Table({ title, rows, label }: { title: string; rows: LiquidityRow[]; label?: (k: string) => string }) {
  return (
    <section className="card overflow-x-auto">
      <div className="border-b border-line px-4 py-3 h3">{title}</div>
      <table className="table">
        <thead><tr><th>Segment</th><th>Demand</th><th>Supply</th><th>Ratio</th><th>Signal</th></tr></thead>
        <tbody>{rows.slice(0, 15).map((r) => (
          <tr key={r.key}><td>{label ? label(r.key) : r.key}</td><td>{r.demand}</td><td>{r.supply}</td><td>{r.ratio === null ? "—" : r.ratio.toFixed(2)}</td>
            <td>{r.flag === "undersupplied" ? <span className="badge-bad">Recruit creators</span> : r.flag === "oversupplied" ? <span className="badge-warn">Recruit brands</span> : r.flag === "thin" ? <span className="badge">Too thin to call</span> : <span className="badge-ok">Balanced</span>}</td></tr>
        ))}{!rows.length && <tr><td colSpan={5} className="text-muted">No data yet.</td></tr>}</tbody>
      </table>
    </section>
  );
}

export default async function Liquidity() {
  const [campaigns, brands, creators, unanswered, deals, outcomes] = await Promise.all([
    db.campaign.findMany({ where: { status: { in: ["OPEN", "IN_PROGRESS"] } }, select: { industry: true, categories: true, targetEmirates: true, languages: true, budgetMaxFils: true } }),
    db.profile.findMany({ where: { type: { in: ["BRAND", "AGENCY"] }, status: "PUBLISHED" }, select: { industry: true, niches: true, emirate: true, languages: true } }),
    db.profile.findMany({ where: { type: { in: ["PODCAST", "INFLUENCER", "GUEST"] }, status: "PUBLISHED" }, select: { type: true, industry: true, niches: true, emirate: true, serviceAreas: true, languages: true, priceFromFils: true, verifiedAt: true } }),
    db.deal.count({ where: { status: "PROPOSED", createdAt: { lte: new Date(Date.now() - 3 * 86400_000) } } }),
    db.deal.findMany({ where: { createdAt: { gte: new Date(Date.now() - 180 * 86400_000) } }, select: { createdAt: true, status: true, events: { where: { type: { in: ["status:AGREED", "status:COMPLETED"] } }, select: { type: true, createdAt: true } }, proposals: { where: { status: "ACCEPTED" }, select: { priceFils: true } } } }),
    db.deal.groupBy({ by: ["status"], where: { matchScore: { not: null } }, _avg: { matchScore: true }, _count: true }),
  ]);
  const demandSets = [...campaigns.map((c) => ({ ind: [c.industry, ...c.categories], em: c.targetEmirates.length ? c.targetEmirates : ["All UAE"], lang: c.languages })), ...brands.map((b) => ({ ind: [b.industry, ...b.niches], em: [b.emirate ?? "All UAE"], lang: b.languages }))];
  const supplySets = creators.map((c) => ({ ind: [c.industry, ...c.niches], em: [c.emirate, ...c.serviceAreas], lang: c.languages }));
  const niche = liquidityTable(countBy(demandSets, (r) => r.ind), countBy(supplySets, (r) => r.ind));
  const emirate = liquidityTable(countBy(demandSets, (r) => r.em), countBy(supplySets, (r) => r.em));
  const lang = liquidityTable(countBy(demandSets, (r) => r.lang), countBy(supplySets, (r) => r.lang));
  const budget = (f: number | null | undefined) => (!f ? "Unspecified" : f < 200000 ? "< AED 2k" : f < 1000000 ? "AED 2k–10k" : f < 5000000 ? "AED 10k–50k" : "AED 50k+");
  const bud = liquidityTable(countBy(campaigns, (c) => [budget(c.budgetMaxFils)]), countBy(creators, (c) => [budget(c.priceFromFils)]));
  const agreedTimes = deals.flatMap((d) => d.events.filter((e) => e.type === "status:AGREED").map((e) => (e.createdAt.getTime() - d.createdAt.getTime()) / 86400_000));
  const avg = (a: number[]) => (a.length ? (a.reduce((s, x) => s + x, 0) / a.length).toFixed(1) : "—");
  const values = deals.flatMap((d) => d.proposals.map((p) => p.priceFils)).filter((v) => v > 0);
  const decided = deals.filter((d) => !["PROPOSED", "NEGOTIATING"].includes(d.status));
  const success = decided.filter((d) => !["DECLINED", "CANCELLED"].includes(d.status)).length;
  return (
    <div className="space-y-6">
      <PageHeader title="Marketplace health" sub="Supply vs demand by segment, to steer recruitment. Demand = open campaigns + published brands; supply = published creators, podcasts and guests." />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="Creators / brands" value={`${creators.length} / ${brands.length}`} note={`${creators.filter((c) => c.verifiedAt).length} creators verified`} />
        <Stat label="Unanswered >3 days" value={unanswered} />
        <Stat label="Avg. days to agreement" value={avg(agreedTimes)} note="last 180 days" />
        <Stat label="Avg. deal value" value={values.length ? `AED ${Math.round(values.reduce((a, b) => a + b, 0) / values.length / 100)}` : "—"} />
        <Stat label="Proposal success rate" value={decided.length ? `${Math.round((success / decided.length) * 100)}%` : "—"} note="not declined/cancelled" />
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <Table title="By niche / industry" rows={niche} />
        <Table title="By emirate" rows={emirate} />
        <Table title="By language" rows={lang} label={languageLabel} />
        <Table title="By budget segment" rows={bud} />
      </div>
      <section className="card-pad">
        <h2 className="h3 mb-2">Match score vs outcome</h2>
        <p className="mb-3 text-sm text-muted">Use this to tune match weights in Config: if completed deals don't score higher than declined ones, the weights aren't predictive yet.</p>
        <table className="table"><thead><tr><th>Outcome</th><th>Deals</th><th>Avg. match score</th></tr></thead>
          <tbody>{outcomes.map((o) => <tr key={o.status}><td>{o.status.toLowerCase()}</td><td>{o._count}</td><td>{o._avg.matchScore?.toFixed(0) ?? "—"}</td></tr>)}</tbody></table>
      </section>
    </div>
  );
}
