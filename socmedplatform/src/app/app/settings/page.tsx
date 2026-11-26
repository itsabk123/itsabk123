import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { Flash, PageHeader } from "@/components/ui";
import { formatDateTime } from "@/lib/time";
import { changePassword, deleteAccount, saveNotificationPrefs, signOutEverywhere, updateAccount } from "./actions";

const GROUPS: [string, string, boolean][] = [["deals", "Proposals, contracts and deliverables", true], ["messages", "New messages", false], ["bookings", "Bookings and reminders", true], ["payments", "Payments and payouts", true], ["opportunities", "New matching opportunities (max daily)", false], ["marketing", "Product news", false]];

export default async function Settings({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const user = await requireUser();
  const [prefs, sessions, subs] = await Promise.all([
    db.notificationPreference.findMany({ where: { userId: user.id } }),
    db.session.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 10 }),
    db.subscription.findMany({ where: { userId: user.id }, include: { plan: true } }),
  ]);
  const pref = (g: string) => prefs.find((p) => p.type === g);
  return (
    <div className="max-w-3xl space-y-8">
      <PageHeader title="Settings" />
      <Flash sp={sp} />
      <form action={updateAccount} className="card-pad space-y-4">
        <h2 className="h3">Account</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className="label" htmlFor="name">Name</label><input id="name" name="name" defaultValue={user.name} className="input" /></div>
          <div><label className="label" htmlFor="email">Email</label><input id="email" value={user.email} disabled className="input opacity-60" /><p className="hint">{user.emailVerifiedAt ? "Verified" : "Not verified"}</p></div>
          <div><label className="label" htmlFor="phone">Phone (optional)</label><input id="phone" name="phone" defaultValue={user.phone ?? ""} className="input" placeholder="+971…" /></div>
          <div><label className="label" htmlFor="timezone">Timezone</label><input id="timezone" name="timezone" defaultValue={user.timezone} className="input" /><p className="hint">IANA name, e.g. Asia/Dubai, Europe/London</p></div>
          <div><label className="label" htmlFor="locale">Language</label><select id="locale" name="locale" defaultValue={user.locale} className="input"><option value="en">English</option><option value="ar">العربية</option></select></div>
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="marketingOptIn" defaultChecked={user.marketingOptIn} /> Product news by email</label>
        <button className="btn-primary">Save</button>
      </form>

      <form id="notifications" action={saveNotificationPrefs} className="card-pad space-y-3">
        <h2 className="h3">Notifications</h2>
        <table className="table"><thead><tr><th>Type</th><th>In-app</th><th>Email</th></tr></thead>
          <tbody>{GROUPS.map(([g, l, defEmail]) => (
            <tr key={g}><td>{l}</td><td><input type="checkbox" name={`${g}_inApp`} defaultChecked={pref(g)?.inApp ?? true} aria-label={`${l} in-app`} /></td><td><input type="checkbox" name={`${g}_email`} defaultChecked={pref(g)?.email ?? defEmail} aria-label={`${l} email`} /></td></tr>
          ))}</tbody></table>
        <p className="hint">Payment and security notices are always shown in-app. WhatsApp notifications will be offered only with your explicit consent once available.</p>
        <button className="btn-secondary">Save preferences</button>
      </form>

      <section className="card-pad space-y-3 text-sm">
        <h2 className="h3">Plan</h2>
        {subs.length ? subs.map((s) => <div key={s.id}>{s.plan.name} · {s.status.toLowerCase()}</div>) : <p className="text-muted">Free plan. See <a href="/pricing" className="link">pricing</a> for upgrades — paid plans are activated by our team during the founding period.</p>}
      </section>

      <form action={changePassword} className="card-pad space-y-4">
        <h2 className="h3">Password</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className="label" htmlFor="current">Current password</label><input id="current" name="current" type="password" required className="input" autoComplete="current-password" /></div>
          <div><label className="label" htmlFor="password">New password</label><input id="password" name="password" type="password" required minLength={10} className="input" autoComplete="new-password" /></div>
        </div>
        <button className="btn-secondary">Change password</button>
      </form>

      <section className="card-pad space-y-3 text-sm">
        <h2 className="h3">Sessions</h2>
        <ul className="space-y-1 text-muted">{sessions.map((s) => <li key={s.id}>{formatDateTime(s.createdAt, user.timezone)} · {s.ip} · {s.userAgent?.slice(0, 60)}</li>)}</ul>
        <form action={signOutEverywhere}><button className="btn-secondary btn-sm">Sign out everywhere</button></form>
      </section>

      <section className="card-pad space-y-3 text-sm">
        <h2 className="h3">Your data</h2>
        <p className="text-muted">Download a copy of your personal data (JSON), or delete your account.</p>
        <a href="/api/account/export" className="btn-secondary btn-sm">Export my data</a>
        <form action={deleteAccount} className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
          <input name="confirm" className="input !w-40" placeholder="Type DELETE" />
          <button className="btn-danger btn-sm">Delete account</button>
          <span className="text-xs text-muted">Profiles are removed; invoices are retained as required by law.</span>
        </form>
      </section>
    </div>
  );
}
