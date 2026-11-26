import { requireActing } from "@/lib/access";
import { Checks, Flash, PageHeader, Select } from "@/components/ui";
import { CAMPAIGN_OBJECTIVES, CONTENT_FORMATS, EMIRATES, INDUSTRIES, LANGUAGES, REGULATED_CATEGORIES, SUCCESS_METRICS } from "@/lib/taxonomy";
import { createCampaign } from "../actions";
import { Autosave } from "@/components/autosave";
import { DraftButton } from "@/components/draft-button";
import { ChoiceButton } from "@/components/choice-button";

const Step = ({ n, title, children }: { n: number; title: string; children: React.ReactNode }) => (
  <section className="card-pad space-y-4">
    <div className="flex items-center gap-3"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-ink text-xs text-paper">{n}</span><h2 className="h3">{title}</h2></div>
    {children}
  </section>
);

export default async function NewCampaign({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const { acting } = await requireActing();
  if (acting.type !== "BRAND" && acting.type !== "AGENCY") return <PageHeader title="New campaign" sub="Switch to a brand or agency profile to create a campaign." />;
  const langLabels = Object.fromEntries(LANGUAGES.map((l) => [l.code, l.label]));
  return (
    <div className="max-w-3xl">
      <PageHeader eyebrow={acting.displayName} title="New campaign" sub="Six short steps. Only the name, objective and creator type are required — the more you add, the better your matches." />
      <Flash sp={sp} />
      <form id="campaign-form" action={createCampaign} className="space-y-4">
        <Autosave formId="campaign-form" storageKey={`campaign-draft-${acting.id}`} />
        <Step n={1} title="Goal">
          <div><label className="label" htmlFor="name">Campaign name *</label><input id="name" name="name" required className="input" placeholder="e.g. Q1 off-plan launch — Dubai Hills" /></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className="label" htmlFor="objective">Objective *</label><Select name="objective" options={CAMPAIGN_OBJECTIVES} required /></div>
            <div><label className="label" htmlFor="industry">Industry</label><Select name="industry" options={INDUSTRIES} value={acting.industry} /></div>
          </div>
          <div><label className="label" htmlFor="product">Product or service</label><input id="product" name="product" className="input" /></div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="recurring" /> This is a recurring partnership (monthly or seasonal)</label>
        </Step>
        <Step n={2} title="Audience">
          <div><label className="label" htmlFor="targetCustomer">Target customer</label><textarea id="targetCustomer" name="targetCustomer" className="input" rows={2} placeholder="Who are you trying to reach and what do they care about?" /></div>
          <div><span className="label">Emirates</span><Checks name="targetEmirates" options={EMIRATES} /><p className="hint">Leave empty for all UAE.</p></div>
          <div><span className="label">Languages</span><Checks name="languages" options={LANGUAGES.map((l) => l.code)} labels={langLabels} /></div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div><label className="label" htmlFor="audienceType">Audience</label><Select name="audienceType" options={["B2C", "B2B", "BOTH"]} labels={{ BOTH: "Both" }} /></div>
            <div><label className="label" htmlFor="ageMin">Age from</label><input id="ageMin" name="ageMin" type="number" min={13} max={99} className="input" /></div>
            <div><label className="label" htmlFor="ageMax">Age to</label><input id="ageMax" name="ageMax" type="number" min={13} max={99} className="input" /></div>
          </div>
          <p className="hint">We don't target by gender, nationality or other sensitive attributes in matching.</p>
        </Step>
        <Step n={3} title="Who you want">
          <div><span className="label">Creator types *</span><Checks name="creatorTypes" options={["PODCAST", "INFLUENCER", "GUEST"]} labels={{ PODCAST: "Podcasts", INFLUENCER: "Influencers & UGC", GUEST: "Expert guests" }} /></div>
          <div><label className="label" htmlFor="categories">Creator categories / niches</label><input id="categories" name="categories" className="input" placeholder="Comma-separated, e.g. Real estate, Personal finance" /></div>
          <div><span className="label">Content formats</span><Checks name="contentFormats" options={CONTENT_FORMATS} /></div>
          <div><label className="label" htmlFor="minAudience">Minimum audience size</label><input id="minAudience" name="minAudience" inputMode="numeric" className="input" placeholder="Optional — smaller, relevant audiences often perform better" /></div>
        </Step>
        <Step n={4} title="Budget & timing">
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className="label" htmlFor="budgetMin">Budget per creator from (AED)</label><input id="budgetMin" name="budgetMin" inputMode="decimal" className="input" /></div>
            <div><label className="label" htmlFor="budgetMax">Up to (AED)</label><input id="budgetMax" name="budgetMax" inputMode="decimal" className="input" /></div>
            <div><label className="label" htmlFor="startDate">Start</label><input id="startDate" name="startDate" type="date" className="input" /></div>
            <div><label className="label" htmlFor="endDate">End</label><input id="endDate" name="endDate" type="date" className="input" /></div>
          </div>
        </Step>
        <Step n={5} title="Brief & deliverables">
          <div><label className="label" htmlFor="deliverables">Deliverables</label><textarea id="deliverables" name="deliverables" className="input font-mono text-sm" rows={3} placeholder={"2x Reel\n1x Host-read mid-roll\n3x Story"} /><p className="hint">One per line, e.g. "2x Reel".</p></div>
          <div><label className="label" htmlFor="instructions">Creative brief</label><textarea id="instructions" name="instructions" className="input" rows={6} />
            <div className="mt-2"><DraftButton kind="campaign_brief" target="instructions" /></div></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className="label" htmlFor="callToAction">Call to action</label><input id="callToAction" name="callToAction" className="input" placeholder="e.g. Book a viewing" /></div>
            <div><label className="label" htmlFor="landingUrl">Landing page</label><input id="landingUrl" name="landingUrl" className="input" placeholder="https://" /></div>
          </div>
          <div><span className="label">Success metrics</span><Checks name="successMetrics" options={SUCCESS_METRICS} /></div>
          <div><label className="label" htmlFor="brandSafety">Brand safety requirements</label><textarea id="brandSafety" name="brandSafety" className="input" rows={2} placeholder="Topics or content to avoid, competitor exclusions…" /></div>
        </Step>
        <Step n={6} title="Compliance & visibility">
          <div><label className="label" htmlFor="regulatedCategory">Is this a regulated category?</label><Select name="regulatedCategory" options={Object.keys(REGULATED_CATEGORIES)} labels={REGULATED_CATEGORIES} placeholder="No — not regulated" />
            <p className="hint">Regulated campaigns are reviewed by our team before going live. You may be asked for sector approvals.</p></div>
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2"><input type="radio" name="visibility" value="PUBLIC" defaultChecked /> Public — creators can discover and apply</label>
            <label className="flex items-center gap-2"><input type="radio" name="visibility" value="PRIVATE" /> Private — invite only</label>
          </div>
        </Step>
        <div className="flex flex-wrap gap-2">
          <ChoiceButton name="intent" value="publish" className="btn-primary">Publish campaign</ChoiceButton>
          <ChoiceButton name="intent" value="draft" className="btn-secondary">Save as draft</ChoiceButton>
        </div>
      </form>
    </div>
  );
}
