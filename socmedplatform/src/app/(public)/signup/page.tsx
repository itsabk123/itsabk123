import Link from "next/link";
import { redirect } from "next/navigation";
import { signup } from "@/app/auth-actions";
import { getCurrentUser } from "@/lib/auth";
import { Flash } from "@/components/ui";

export const metadata = { title: "Join free", robots: { index: false } };
const ROLES = [
  ["BRAND", "Brand / advertiser", "Find podcasts and creators"],
  ["PODCAST", "Podcast host", "Find sponsors and guests"],
  ["GUEST", "Expert / guest", "Get booked on podcasts"],
  ["INFLUENCER", "Creator / influencer", "Get brand deals"],
  ["AGENCY", "Agency", "Manage clients and talent"],
];

export default async function Signup({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  if (await getCurrentUser()) redirect(sp.next || "/app");
  return (
    <div className="page max-w-xl py-14">
      <h1 className="h2">Create your free account</h1>
      <p className="mt-2 text-muted">One account for every role. You can add more profiles later.</p>
      <div className="mt-6"><Flash sp={sp} /></div>
      <form action={signup} className="card-pad space-y-5">
        <fieldset>
          <legend className="label">I'm joining as…</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {ROLES.map(([v, l, s]) => (
              <label key={v} className="flex cursor-pointer items-start gap-3 rounded-xl border border-line p-3 has-[:checked]:border-ink">
                <input type="radio" name="role" value={v} defaultChecked={sp.role === v} className="mt-1" />
                <span><span className="block text-sm font-medium text-ink">{l}</span><span className="text-xs text-muted">{s}</span></span>
              </label>
            ))}
          </div>
          <p className="hint">Not sure? Skip this — you can choose after signing up.</p>
        </fieldset>
        <div><label className="label" htmlFor="name">Full name</label><input id="name" name="name" required className="input" defaultValue={sp.name} autoComplete="name" /></div>
        <div><label className="label" htmlFor="email">Work email</label><input id="email" name="email" type="email" required className="input" defaultValue={sp.email} autoComplete="email" /></div>
        <div><label className="label" htmlFor="password">Password</label><input id="password" name="password" type="password" required minLength={10} className="input" autoComplete="new-password" /><p className="hint">At least 10 characters with letters and numbers.</p></div>
        <input type="hidden" name="next" value={sp.next ?? ""} />
        <input type="hidden" name="ref" value={sp.ref ?? ""} />
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="terms" required className="mt-1" /> <span>I agree to the <Link href="/legal/terms" className="link">Terms</Link> and <Link href="/legal/privacy" className="link">Privacy Policy</Link>.</span></label>
        <label className="flex items-start gap-2 text-sm text-muted"><input type="checkbox" name="marketing" className="mt-1" /> Send me occasional product news (optional).</label>
        <button className="btn-primary w-full">Create account</button>
        <p className="text-center text-sm text-muted">Already have an account? <Link href={`/login${sp.next ? `?next=${encodeURIComponent(sp.next)}` : ""}`} className="link">Log in</Link></p>
      </form>
    </div>
  );
}
