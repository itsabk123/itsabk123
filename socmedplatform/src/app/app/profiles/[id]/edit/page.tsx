import { ChoiceButton } from "@/components/choice-button";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireProfileAccess } from "@/lib/access";
import { completenessItems } from "@/lib/completeness";
import { permitState } from "@/lib/compliance";
import { Checks, Flash, PageHeader, Select, SourceTag } from "@/components/ui";
import { CAMPAIGN_OBJECTIVES, CONTENT_FORMATS, EMIRATES, GUEST_APPEARANCE_TYPES, INDUSTRIES, LANGUAGES, OFFERING_KINDS, PLATFORMS, PROFILE_TYPE_META, platformLabel } from "@/lib/taxonomy";
import { formatAed, formatNumber, toAed } from "@/lib/money";
import { WEEKDAYS, formatDate, minutesToHHMM } from "@/lib/time";
import { DraftButton } from "@/components/draft-button";
import {
  addAvailability, addMetric, addOffering, addSocialAccount, deleteProfile, removeAvailability, removeMetric,
  removeSocialAccount, setAudience, setPublished, toggleOffering, updateProfile, uploadDocument,
} from "../../actions";

const langLabels = Object.fromEntries(LANGUAGES.map((l) => [l.code, l.label]));

export default async function EditProfile({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> }) {
  const { id } = await params;
  const sp = await searchParams;
  await requireProfileAccess(id);
  const p = await db.profile.findUnique({
    where: { id },
    include: { brand: true, podcast: true, guest: true, influencer: true, agency: true, socialAccounts: true, metrics: true, audience: true, offerings: { orderBy: { createdAt: "asc" } }, availability: true, documents: { orderBy: { createdAt: "desc" } } },
  });
  if (!p) notFound();
  const items = completenessItems({ ...p, offerings: p.offerings.filter((o) => o.isActive) });
  const done = items.filter((i) => i.done).length;
  const links = (p.links ?? {}) as Record<string, string>;
  const kinds = Object.entries(OFFERING_KINDS).filter(([, k]) => p.type === "BRAND" || p.type === "AGENCY" ? false : (k.for as string[]).includes(p.type));
  const permit = p.type === "INFLUENCER" ? permitState(p.influencer?.advertiserPermitNo, p.influencer?.permitExpiresAt) : null;
  const t = (name: string, label: string, value?: string | number | null, opts: { type?: string; placeholder?: string; hint?: string } = {}) => (
    <div>
      <label className="label" htmlFor={name}>{label}</label>
      <input id={name} name={name} type={opts.type ?? "text"} defaultValue={value ?? ""} className="input" placeholder={opts.placeholder} />
      {opts.hint && <p className="hint">{opts.hint}</p>}
    </div>
  );
  const csv = (name: string, label: string, value: string[] | undefined, hint = "Comma-separated") => t(name, label, value?.join(", "), { hint });

  return (
    <div>
      <PageHeader
        eyebrow={`${PROFILE_TYPE_META[p.type].label} profile · ${p.status.toLowerCase()}`}
        title={p.displayName}
        sub={<>Public URL: <Link href={`/p/${p.slug}`} className="link">/p/{p.slug}</Link></>}
        actions={
          <form action={setPublished} className="flex gap-2">
            <input type="hidden" name="id" value={p.id} />
            <Link href={`/p/${p.slug}`} className="btn-secondary">Preview</Link>
            {p.status === "PUBLISHED" ? <ChoiceButton name="publish" value="0" className="btn-ghost">Unpublish</ChoiceButton> : <ChoiceButton name="publish" value="1" className="btn-primary">Publish profile</ChoiceButton>}
          </form>
        }
      />
      <Flash sp={sp} />

      <div className="card-pad mb-8">
        <div className="flex items-center justify-between"><div className="h3">Profile strength</div><div className="text-sm text-muted">{done}/{items.length}</div></div>
        <div className="mt-2 h-1.5 rounded-full bg-paper-deep"><div className="h-1.5 rounded-full bg-ink" style={{ width: `${(done / items.length) * 100}%` }} /></div>
        <ul className="mt-4 grid gap-1 text-sm sm:grid-cols-2">{items.map((i) => <li key={i.key} className={i.done ? "text-muted line-through" : ""}>{i.done ? "✓" : "○"} {i.label}</li>)}</ul>
        <p className="hint mt-3">You can explore now. A published profile with these basics is needed to apply to campaigns or accept bookings.</p>
      </div>

      <form action={updateProfile} className="space-y-8">
        <input type="hidden" name="id" value={p.id} />
        <section className="card-pad space-y-4">
          <h2 className="h3">Basics</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {t("displayName", p.type === "PODCAST" ? "Podcast title" : "Display name", p.displayName)}
            {t("slug", "Profile URL", p.slug, { hint: "Letters, numbers and dashes" })}
          </div>
          {t("headline", "Headline", p.headline, { placeholder: "One line that says what you do and for whom" })}
          <div>
            <label className="label" htmlFor="bio">Bio</label>
            <textarea id="bio" name="bio" defaultValue={p.bio ?? ""} className="input" rows={6} />
            <div className="mt-2"><DraftButton kind="bio" profileId={p.id} target="bio" /></div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {t("avatarUrl", "Profile image URL", p.avatarUrl, { placeholder: "https://…", hint: "Square image, at least 400px" })}
            {t("coverUrl", "Cover image URL", p.coverUrl, { placeholder: "https://…" })}
          </div>
        </section>

        <section className="card-pad space-y-4">
          <h2 className="h3">Location, language & focus</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className="label" htmlFor="emirate">Emirate</label><Select name="emirate" options={EMIRATES} value={p.emirate} /></div>
            {t("city", "City / area", p.city, { placeholder: "e.g. Business Bay" })}
          </div>
          <div><span className="label">Also serve</span><Checks name="serviceAreas" options={[...EMIRATES, "All UAE", "GCC"]} selected={p.serviceAreas} /></div>
          <div><span className="label">Languages</span><Checks name="languages" options={LANGUAGES.map((l) => l.code)} labels={langLabels} selected={p.languages} /></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className="label" htmlFor="industry">Industry</label><Select name="industry" options={INDUSTRIES} value={p.industry} /></div>
            {csv("niches", "Niches", p.niches, "e.g. Proptech, Personal finance, Halal food")}
          </div>
          {csv("subIndustries", "Sub-industries", p.subIndustries)}
        </section>

        {p.type === "BRAND" && p.brand && (
          <section className="card-pad space-y-4">
            <h2 className="h3">Business & marketing</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <div><label className="label" htmlFor="companySize">Company size</label><Select name="companySize" options={["1-10", "11-50", "51-200", "201-1000", "1000+"]} value={p.brand.companySize} /></div>
              <div><label className="label" htmlFor="audienceType">Sells to</label><Select name="audienceType" options={["B2B", "B2C", "BOTH"]} labels={{ BOTH: "B2B & B2C" }} value={p.brand.audienceType} /></div>
              {t("website", "Website", p.website)}
            </div>
            <div><span className="label">Target emirates</span><Checks name="targetGeographies" options={EMIRATES} selected={p.brand.targetGeographies} /></div>
            {t("targetAudience", "Target audience", p.brand.targetAudience, { placeholder: "e.g. Expat professionals 25–44 considering first property purchase" })}
            <div className="grid gap-4 sm:grid-cols-2">
              {t("budgetMin", "Typical budget from (AED)", p.brand.budgetMinFils ? toAed(p.brand.budgetMinFils) : "", { type: "number" })}
              {t("budgetMax", "Typical budget up to (AED)", p.brand.budgetMaxFils ? toAed(p.brand.budgetMaxFils) : "", { type: "number" })}
            </div>
            <div><span className="label">Objectives</span><Checks name="objectives" options={CAMPAIGN_OBJECTIVES} selected={p.brand.objectives} /></div>
            <div><span className="label">Preferred platforms</span><Checks name="preferredPlatforms" options={PLATFORMS} labels={platformLabel} selected={p.brand.preferredPlatforms} /></div>
            {csv("productCategories", "Product categories", p.brand.productCategories)}
          </section>
        )}

        {p.type === "PODCAST" && p.podcast && (
          <section className="card-pad space-y-4">
            <h2 className="h3">Show details</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              {t("hostNames", "Host(s)", p.podcast.hostNames)}
              {t("productionCompany", "Production company", p.podcast.productionCompany)}
              <div><label className="label" htmlFor="format">Format</label><Select name="format" options={["AUDIO", "VIDEO", "BOTH"]} labels={{ AUDIO: "Audio", VIDEO: "Video", BOTH: "Audio + video" }} value={p.podcast.format} /></div>
              <div><label className="label" htmlFor="frequency">Frequency</label><Select name="frequency" options={["Daily", "Weekly", "Fortnightly", "Monthly", "Seasonal"]} value={p.podcast.frequency} /></div>
              {t("avgDurationMin", "Avg. episode length (min)", p.podcast.avgDurationMin, { type: "number" })}
              {t("episodeCount", "Episodes published", p.podcast.episodeCount, { type: "number" })}
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              {t("spotifyUrl", "Spotify URL", p.podcast.spotifyUrl)}
              {t("appleUrl", "Apple Podcasts URL", p.podcast.appleUrl)}
              {t("youtubeUrl", "YouTube URL", p.podcast.youtubeUrl)}
            </div>
            {t("recordingLocation", "Recording location", p.podcast.recordingLocation)}
            {t("website", "Website", p.website)}
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="guestBookingOpen" defaultChecked={p.podcast.guestBookingOpen} /> I'm currently booking guests</label>
            <div><label className="label" htmlFor="guestRequirements">Guest requirements</label><textarea id="guestRequirements" name="guestRequirements" defaultValue={p.podcast.guestRequirements ?? ""} className="input" placeholder="Who you're looking for, topics, any fees for sponsored interviews" /></div>
            <div><label className="label" htmlFor="recordingRequirements">Recording requirements</label><textarea id="recordingRequirements" name="recordingRequirements" defaultValue={p.podcast.recordingRequirements ?? ""} className="input" placeholder="Studio, remote setup, mic, prep call…" /></div>
          </section>
        )}

        {p.type === "GUEST" && p.guest && (
          <section className="card-pad space-y-4">
            <h2 className="h3">Expertise & appearances</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              {t("professionalTitle", "Professional title", p.guest.professionalTitle)}
              {t("company", "Company", p.guest.company)}
              <div><label className="label" htmlFor="seniority">Seniority</label><Select name="seniority" options={["Founder", "C-level", "Director", "Manager", "Specialist", "Academic", "Creator"]} value={p.guest.seniority} /></div>
            </div>
            {csv("expertise", "Areas of expertise", p.guest.expertise)}
            {csv("topics", "Topics I can discuss", p.guest.topics)}
            {csv("excludedTopics", "Topics I won't discuss", p.guest.excludedTopics)}
            {csv("preferredCategories", "Preferred podcast categories", p.guest.preferredCategories)}
            <div><span className="label">Open to</span><Checks name="appearanceTypes" options={Object.keys(GUEST_APPEARANCE_TYPES)} labels={GUEST_APPEARANCE_TYPES} selected={p.guest.appearanceTypes} /><p className="hint">Choose any that apply. We never assume guests expect payment.</p></div>
            <div className="flex flex-wrap gap-4 text-sm">
              <label className="flex items-center gap-2"><input type="checkbox" name="virtualAvailable" defaultChecked={p.guest.virtualAvailable} /> Remote recording OK</label>
              <label className="flex items-center gap-2"><input type="checkbox" name="willingToTravel" defaultChecked={p.guest.willingToTravel} /> Willing to travel</label>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              {t("linkedinUrl", "LinkedIn", p.guest.linkedinUrl)}
              {t("introVideoUrl", "Intro video URL", p.guest.introVideoUrl)}
              {t("mediaKitUrl", "Media kit URL", p.guest.mediaKitUrl)}
            </div>
            {t("website", "Website", p.website)}
            {csv("objectives", "What I want from appearances", p.guest.objectives, "e.g. Thought leadership, Hiring, Book launch")}
          </section>
        )}

        {p.type === "INFLUENCER" && p.influencer && (
          <section className="card-pad space-y-4">
            <h2 className="h3">Creator details</h2>
            {t("creatorName", "Creator name / handle", p.influencer.creatorName)}
            <div><span className="label">Content formats</span><Checks name="contentFormats" options={CONTENT_FORMATS} selected={p.influencer.contentFormats} /></div>
            {csv("preferredCategories", "Preferred campaign categories", p.influencer.preferredCategories)}
            {csv("brandExclusions", "Brands or categories I won't work with", p.influencer.brandExclusions)}
            <div className="grid gap-4 sm:grid-cols-3">
              {t("advertiserPermitNo", "UAE advertiser permit no.", p.influencer.advertiserPermitNo, { hint: "If you hold one. Upload proof under Verification." })}
              {t("permitExpiresAt", "Permit expiry", p.influencer.permitExpiresAt?.toISOString().slice(0, 10), { type: "date" })}
              {t("mediaKitUrl", "Media kit URL", p.influencer.mediaKitUrl)}
            </div>
            {permit && <p className={`text-sm ${permit.state === "ok" ? "text-muted" : "text-warn"}`}>{permit.label}</p>}
            {t("nationality", "Nationality (optional)", p.influencer.nationality, { hint: "Voluntary. Never used for matching or ranking." })}
            {t("website", "Website", p.website)}
          </section>
        )}

        {p.type === "AGENCY" && p.agency && (
          <section className="card-pad space-y-4">
            <h2 className="h3">Agency</h2>
            <div><label className="label" htmlFor="agencyType">Agency type</label><Select name="agencyType" options={["ADVERTISING", "TALENT", "PODCAST_PRODUCTION", "PR"]} labels={{ ADVERTISING: "Advertising", TALENT: "Talent management", PODCAST_PRODUCTION: "Podcast production", PR: "PR" }} value={p.agency.agencyType} /></div>
            {csv("services", "Services", p.agency.services)}
            {t("website", "Website", p.website)}
          </section>
        )}

        <section className="card-pad space-y-4">
          <h2 className="h3">Links & contact</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {["instagram", "tiktok", "youtube", "linkedin", "x", "facebook", "snapchat"].map((k) => t(`link_${k}`, k[0].toUpperCase() + k.slice(1), links[k]))}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">{t("contactEmail", "Business contact email", p.contactEmail, { type: "email" })}</div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="showContact" defaultChecked={p.showContact} /> Show business email to signed-in members</label>
        </section>

        <section className="card-pad space-y-3">
          <h2 className="h3">Privacy</h2>
          <div className="flex flex-wrap gap-4 text-sm">
            {(["PUBLIC", "MEMBERS", "PRIVATE"] as const).map((v) => (
              <label key={v} className="flex items-center gap-2"><input type="radio" name="visibility" value={v} defaultChecked={p.visibility === v} /> {v === "PUBLIC" ? "Public" : v === "MEMBERS" ? "Signed-in members only" : "Private (invite only)"}</label>
            ))}
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="indexable" defaultChecked={p.indexable} /> Allow search engines to index my public profile</label>
        </section>
        <div className="sticky bottom-4 z-10 flex justify-end"><button className="btn-primary shadow-sm">Save changes</button></div>
      </form>

      {p.type !== "BRAND" && p.type !== "AGENCY" && (
        <section id="audience" className="mt-10 space-y-4">
          <h2 className="h2">Audience & metrics</h2>
          <p className="text-sm text-muted">Figures you enter are shown as <SourceTag source="CREATOR_REPORTED" />. Verified badges are added only after an API connection or a manual review of evidence you upload.</p>
          <div className="card overflow-x-auto">
            <table className="table">
              <thead><tr><th>Channel</th><th>Followers</th><th>Avg. views</th><th>Engagement</th><th>Source</th><th /></tr></thead>
              <tbody>
                {p.socialAccounts.map((s) => (
                  <tr key={s.id}>
                    <td>{platformLabel[s.platform]} @{s.handle}</td><td>{formatNumber(s.followers)}</td><td>{formatNumber(s.avgViews)}</td><td>{s.engagementRate ?? "—"}%</td><td><SourceTag source={s.source} /></td>
                    <td><form action={removeSocialAccount}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="accountId" value={s.id} /><button className="text-xs text-muted underline">Remove</button></form></td>
                  </tr>
                ))}
                {!p.socialAccounts.length && <tr><td colSpan={6} className="text-muted">No channels yet.</td></tr>}
              </tbody>
            </table>
          </div>
          <form action={addSocialAccount} className="card-pad grid gap-3 sm:grid-cols-7">
            <input type="hidden" name="id" value={p.id} />
            <select name="platform" className="input sm:col-span-1" required><option value="">Platform</option>{PLATFORMS.map((x) => <option key={x} value={x}>{platformLabel[x]}</option>)}</select>
            <input name="handle" className="input" placeholder="@handle" required />
            <input name="url" className="input" placeholder="Profile URL" />
            <input name="followers" className="input" placeholder="Followers" inputMode="numeric" />
            <input name="avgViews" className="input" placeholder="Avg. views" inputMode="numeric" />
            <input name="engagementRate" className="input" placeholder="Engagement %" inputMode="decimal" />
            <button className="btn-secondary">Add channel</button>
          </form>

          {p.type === "PODCAST" && (
            <>
              <div className="card overflow-x-auto">
                <table className="table">
                  <thead><tr><th>Metric</th><th>Value</th><th>Period</th><th>Source</th><th /></tr></thead>
                  <tbody>
                    {p.metrics.map((m) => (
                      <tr key={m.id}><td>{m.key.replaceAll("_", " ")}</td><td>{formatNumber(m.value)}</td><td>{m.periodLabel ?? "—"}</td><td><SourceTag source={m.source} /></td>
                        <td><form action={removeMetric}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="metricId" value={m.id} /><button className="text-xs text-muted underline">Remove</button></form></td></tr>
                    ))}
                    {!p.metrics.length && <tr><td colSpan={5} className="text-muted">Add monthly downloads or views.</td></tr>}
                  </tbody>
                </table>
              </div>
              <form action={addMetric} className="card-pad grid gap-3 sm:grid-cols-4">
                <input type="hidden" name="id" value={p.id} />
                <select name="key" className="input" required><option value="monthly_downloads">Monthly downloads</option><option value="monthly_video_views">Monthly video views</option><option value="avg_listens_per_episode">Avg. listens per episode</option><option value="avg_views_per_episode">Avg. views per episode</option><option value="completion_rate_pct">Completion rate %</option></select>
                <input name="value" className="input" placeholder="Value" inputMode="decimal" required />
                <input name="periodLabel" className="input" placeholder="Period, e.g. Oct 2026" />
                <button className="btn-secondary">Add metric</button>
              </form>
            </>
          )}

          <div className="grid gap-4 md:grid-cols-3">
            {(["GEO", "AGE", "INTEREST"] as const).map((dim) => (
              <form key={dim} action={setAudience} className="card-pad space-y-2">
                <input type="hidden" name="id" value={p.id} /><input type="hidden" name="dimension" value={dim} />
                <div className="h3">{dim === "GEO" ? "Audience location" : dim === "AGE" ? "Audience age" : "Audience interests"}</div>
                <textarea name="rows" className="input font-mono text-xs" rows={6} defaultValue={p.audience.filter((a) => a.dimension === dim).map((a) => `${a.bucket}: ${a.share}`).join("\n")} placeholder={dim === "GEO" ? "Dubai: 45\nAbu Dhabi: 20\nSaudi Arabia: 10" : dim === "AGE" ? "18-24: 20\n25-34: 45\n35-44: 25" : "Real estate: 40\nPersonal finance: 30"} />
                <p className="hint">One per line as "label: percent". From your platform analytics.</p>
                <button className="btn-secondary btn-sm">Save</button>
              </form>
            ))}
          </div>
        </section>
      )}

      {kinds.length > 0 && (
        <section id="offerings" className="mt-10 space-y-4">
          <h2 className="h2">{p.type === "PODCAST" ? "Sponsorship packages" : p.type === "GUEST" ? "Appearance options" : "Services & rates"}</h2>
          <div className="grid gap-2">
            {p.offerings.map((o) => (
              <div key={o.id} className={`card flex flex-wrap items-center gap-3 p-4 ${o.isActive ? "" : "opacity-60"}`}>
                <div className="min-w-0 flex-1"><div className="font-medium text-ink">{o.title}</div><div className="text-sm text-muted">{OFFERING_KINDS[o.kind]?.label} · {o.priceType === "FREE" ? "Free" : o.priceType === "ON_REQUEST" ? "On request" : formatAed(o.priceFils)}{o.inventoryTotal !== null ? ` · ${o.inventoryUsed}/${o.inventoryTotal} booked` : ""}{o.bookable ? " · bookable slot" : ""}</div></div>
                <form action={toggleOffering}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="offeringId" value={o.id} /><button className="btn-ghost btn-sm">{o.isActive ? "Pause" : "Activate"}</button></form>
              </div>
            ))}
          </div>
          <form action={addOffering} className="card-pad grid gap-3 sm:grid-cols-2">
            <input type="hidden" name="id" value={p.id} />
            <select name="kind" className="input" required><option value="">Format…</option>{kinds.map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select>
            <input name="title" className="input" placeholder="Package name, e.g. 60-sec host-read mid-roll" required />
            <select name="priceType" className="input" defaultValue="FIXED"><option value="FIXED">Fixed price</option><option value="FROM">From price</option><option value="ON_REQUEST">On request</option><option value="FREE">Free</option></select>
            <input name="price" className="input" placeholder="Price (AED)" inputMode="decimal" />
            <input name="deliveryDays" className="input" placeholder="Delivery within (days)" inputMode="numeric" />
            <input name="inventoryTotal" className="input" placeholder="Slots available (blank = unlimited)" inputMode="numeric" />
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="bookable" /> Requires a time slot (uses availability)</label>
            <input name="durationMin" className="input" placeholder="Slot length (min)" inputMode="numeric" />
            <textarea name="description" className="input sm:col-span-2" placeholder="What's included" rows={3} />
            <div><button className="btn-secondary">Add package</button></div>
          </form>
        </section>
      )}

      {p.type !== "BRAND" && (
        <section id="availability" className="mt-10 space-y-4">
          <h2 className="h2">Availability</h2>
          <p className="text-sm text-muted">Weekly hours for bookable services, in your timezone. Requesters see slots in their own timezone.</p>
          <ul className="space-y-1 text-sm">
            {p.availability.map((a) => (
              <li key={a.id} className="flex items-center gap-3">{WEEKDAYS[a.weekday]} {minutesToHHMM(a.startMinute)}–{minutesToHHMM(a.endMinute)} <span className="text-muted">({a.timezone})</span>
                <form action={removeAvailability}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="ruleId" value={a.id} /><button className="text-xs text-muted underline">Remove</button></form></li>
            ))}
          </ul>
          <form action={addAvailability} className="card-pad flex flex-wrap items-end gap-3">
            <input type="hidden" name="id" value={p.id} />
            <div><label className="label text-xs" htmlFor="weekday">Day</label><select id="weekday" name="weekday" className="input">{WEEKDAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}</select></div>
            <div><label className="label text-xs" htmlFor="start">From</label><input id="start" name="start" type="time" defaultValue="10:00" className="input" /></div>
            <div><label className="label text-xs" htmlFor="end">To</label><input id="end" name="end" type="time" defaultValue="16:00" className="input" /></div>
            <button className="btn-secondary">Add hours</button>
          </form>
        </section>
      )}

      <section id="verification" className="mt-10 space-y-4">
        <h2 className="h2">Verification</h2>
        <p className="text-sm text-muted">Upload a trade licence, advertiser permit, podcast ownership proof or analytics screenshots. Files are private and reviewed by our team. PDF, PNG, JPG or WEBP, max 5 MB.</p>
        {p.verifiedAt && <p className="badge-ok">Verified {formatDate(p.verifiedAt)}</p>}
        <div className="grid gap-2">
          {p.documents.map((d) => (
            <div key={d.id} className="card flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
              <span>{d.kind.replaceAll("_", " ").toLowerCase()} · {d.fileName}{d.expiresAt ? ` · expires ${formatDate(d.expiresAt)}` : ""}</span>
              <span className={d.status === "APPROVED" ? "badge-ok" : d.status === "REJECTED" ? "badge-bad" : "badge-warn"}>{d.status.toLowerCase()}{d.reviewNotes ? ` — ${d.reviewNotes}` : ""}</span>
            </div>
          ))}
        </div>
        <form action={uploadDocument} className="card-pad grid gap-3 sm:grid-cols-5" encType="multipart/form-data">
          <input type="hidden" name="id" value={p.id} />
          <select name="kind" className="input" required><option value="">Document type</option><option value="TRADE_LICENSE">Trade licence</option><option value="ADVERTISER_PERMIT">UAE advertiser permit</option><option value="VISITOR_ADVERTISER_PERMIT">Visitor advertiser permit</option><option value="PODCAST_OWNERSHIP">Podcast ownership proof</option><option value="ANALYTICS_EVIDENCE">Analytics screenshot</option><option value="IDENTITY">Identity document</option><option value="OTHER">Other</option></select>
          <input name="reference" className="input" placeholder="Reference / number" />
          <input name="expiresAt" type="date" className="input" aria-label="Expiry date" />
          <input name="file" type="file" accept="application/pdf,image/png,image/jpeg,image/webp" className="input" required />
          <button className="btn-secondary">Upload</button>
        </form>
      </section>

      <section className="mt-16 border-t border-line pt-6">
        <form action={deleteProfile} className="flex items-center justify-between gap-4">
          <input type="hidden" name="id" value={p.id} />
          <p className="text-sm text-muted">Remove this profile. Your account and other profiles stay. Completed deal records are retained.</p>
          <button className="btn-danger btn-sm">Delete profile</button>
        </form>
      </section>
    </div>
  );
}
