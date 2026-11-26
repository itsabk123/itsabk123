import { EMIRATES, INDUSTRIES, LANGUAGES, OFFERING_KINDS, PLATFORMS, platformLabel, GUEST_APPEARANCE_TYPES } from "@/lib/taxonomy";
import { SORTS, one, type SP } from "@/lib/discovery";
import type { ProfileType } from "@prisma/client";

/** Plain GET form: filters work without JavaScript and every result set has a shareable URL. */
export function Filters({ type, sp, action, signedIn }: { type: ProfileType; sp: SP; action: string; signedIn: boolean }) {
  const v = (k: string) => one(sp, k);
  const sel = (name: string, opts: [string, string][], label: string) => (
    <div>
      <label className="label text-xs" htmlFor={name}>{label}</label>
      <select id={name} name={name} defaultValue={v(name)} className="input">
        <option value="">Any</option>
        {opts.map(([val, l]) => <option key={val} value={val}>{l}</option>)}
      </select>
    </div>
  );
  const kinds = Object.entries(OFFERING_KINDS).filter(([, k]) => type !== "BRAND" && (k.for as string[]).includes(type)).map(([k, m]) => [k, m.label] as [string, string]);
  const sorts = Object.entries(SORTS).filter(([k]) => signedIn || k !== "best") as [string, string][];
  return (
    <form action={action} method="get" className="card-pad space-y-4">
      <div>
        <label className="label text-xs" htmlFor="q">Search</label>
        <input id="q" name="q" defaultValue={v("q")} className="input" placeholder={type === "GUEST" ? "Topic, expertise, name…" : "Name, niche, keyword…"} />
      </div>
      {sel("emirate", EMIRATES.map((e) => [e, e]), "Emirate")}
      {sel("lang", LANGUAGES.map((l) => [l.code, l.label]), "Language")}
      {sel("industry", INDUSTRIES.map((i) => [i, i]), "Industry")}
      {type === "INFLUENCER" && sel("platform", PLATFORMS.map((p) => [p, platformLabel[p]]), "Platform")}
      {type === "PODCAST" && sel("podFormat", [["AUDIO", "Audio"], ["VIDEO", "Video"]], "Format")}
      {type === "GUEST" && sel("appearance", Object.entries(GUEST_APPEARANCE_TYPES), "Appearance type")}
      {type === "GUEST" && sel("seniority", [["Founder", "Founder"], ["C-level", "C-level"], ["Director", "Director"], ["Manager", "Manager"], ["Specialist", "Specialist"], ["Academic", "Academic"]], "Seniority")}
      {type === "BRAND" && sel("audienceType", [["B2B", "B2B"], ["B2C", "B2C"], ["BOTH", "B2B & B2C"]], "Sells to")}
      {kinds.length > 0 && sel("format", kinds, "Collaboration format")}
      {type !== "BRAND" && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label text-xs" htmlFor="minReach">Min. audience</label>
            <input id="minReach" name="minReach" inputMode="numeric" defaultValue={v("minReach")} className="input" placeholder="e.g. 5000" />
          </div>
          <div>
            <label className="label text-xs" htmlFor="maxPrice">Max price (AED)</label>
            <input id="maxPrice" name="maxPrice" inputMode="numeric" defaultValue={v("maxPrice")} className="input" placeholder="e.g. 3000" />
          </div>
        </div>
      )}
      {type === "INFLUENCER" && (
        <div>
          <label className="label text-xs" htmlFor="minEr">Min. engagement %</label>
          <input id="minEr" name="minEr" inputMode="decimal" defaultValue={v("minEr")} className="input" placeholder="e.g. 2" />
        </div>
      )}
      <div className="space-y-2 text-sm">
        <label className="flex items-center gap-2"><input type="checkbox" name="verified" value="1" defaultChecked={v("verified") === "1"} /> Verified profiles only</label>
        {type !== "BRAND" && <label className="flex items-center gap-2"><input type="checkbox" name="audienceSource" value="verified" defaultChecked={v("audienceSource") === "verified"} /> API-verified audience only</label>}
        {type === "PODCAST" && <label className="flex items-center gap-2"><input type="checkbox" name="guestBooking" value="1" defaultChecked={v("guestBooking") === "1"} /> Booking guests now</label>}
        {(type === "GUEST" || type === "INFLUENCER") && <label className="flex items-center gap-2"><input type="checkbox" name="available" value="1" defaultChecked={v("available") === "1"} /> Has availability</label>}
        <label className="flex items-center gap-2"><input type="checkbox" name="activeDays" value="30" defaultChecked={v("activeDays") === "30"} /> Active in last 30 days</label>
      </div>
      {sel("sort", sorts, "Sort by")}
      <div className="flex gap-2">
        <button className="btn-primary flex-1">Apply</button>
        <a href={action} className="btn-ghost">Reset</a>
      </div>
    </form>
  );
}
