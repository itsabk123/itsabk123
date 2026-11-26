import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { createProfile } from "../profiles/actions";
import { EMIRATES, INDUSTRIES, LANGUAGES } from "@/lib/taxonomy";
import { Checks, Flash, PageHeader, Select } from "@/components/ui";

const TYPES = [
  ["BRAND", "Brand / advertiser", "Run campaigns, sponsor podcasts and book creators."],
  ["PODCAST", "Podcast", "List your show, sell sponsorships and book guests."],
  ["GUEST", "Guest / expert", "Get booked on podcasts as an expert or founder."],
  ["INFLUENCER", "Creator / influencer", "Showcase your audience and take brand deals."],
  ["AGENCY", "Agency", "Manage brands, creators and podcast portfolios."],
] as const;

export default async function Onboarding({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const user = await requireUser();
  const orgs = await db.organizationMember.findMany({ where: { userId: user.id, role: { in: ["OWNER", "ADMIN"] } }, include: { organization: true } });
  const type = TYPES.find((t) => t[0] === sp.role);
  return (
    <div className="max-w-3xl">
      <PageHeader eyebrow="Get started" title={type ? `Create your ${type[1].toLowerCase()} profile` : "What would you like to do first?"} sub="Just the basics now — you can explore the marketplace straight away and fill in the rest later." />
      <Flash sp={sp} />
      {!type ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {TYPES.map(([v, l, s]) => (
            <a key={v} href={`/app/onboarding?role=${v}`} className="card p-5 no-underline hover:border-ink"><div className="h3">{l}</div><p className="mt-1 text-sm text-muted">{s}</p></a>
          ))}
          <p className="text-sm text-muted sm:col-span-2">You can hold several profiles on one account — e.g. a podcast and a guest profile.</p>
        </div>
      ) : (
        <form action={createProfile} className="card-pad space-y-5">
          <input type="hidden" name="type" value={type[0]} />
          <div>
            <label className="label" htmlFor="displayName">{type[0] === "BRAND" || type[0] === "AGENCY" ? "Company name" : type[0] === "PODCAST" ? "Podcast title" : "Name shown on your profile"}</label>
            <input id="displayName" name="displayName" required className="input" defaultValue={type[0] === "GUEST" || type[0] === "INFLUENCER" ? user.name : ""} />
          </div>
          {(type[0] === "BRAND" || type[0] === "AGENCY") && orgs.length > 0 && (
            <div>
              <label className="label" htmlFor="organizationId">Organization</label>
              <select id="organizationId" name="organizationId" className="input"><option value="">Create a new organization</option>{orgs.map((o) => <option key={o.organizationId} value={o.organizationId}>{o.organization.name}</option>)}</select>
              <p className="hint">Agencies can add several brand profiles under one organization.</p>
            </div>
          )}
          <div><label className="label" htmlFor="headline">One-line headline</label><input id="headline" name="headline" className="input" maxLength={160} placeholder={type[0] === "PODCAST" ? "Weekly conversations with Gulf founders" : type[0] === "GUEST" ? "Fintech founder on building in the GCC" : ""} /></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className="label" htmlFor="emirate">Emirate</label><Select name="emirate" options={EMIRATES} /></div>
            <div><label className="label" htmlFor="industry">Industry</label><Select name="industry" options={INDUSTRIES} /></div>
          </div>
          <div><span className="label">Languages</span><Checks name="languages" options={LANGUAGES.map((l) => l.code)} labels={Object.fromEntries(LANGUAGES.map((l) => [l.code, l.label]))} selected={["en"]} /></div>
          <div className="flex gap-2"><button className="btn-primary">Create profile</button><a href="/app/onboarding" className="btn-ghost">Back</a></div>
        </form>
      )}
    </div>
  );
}
