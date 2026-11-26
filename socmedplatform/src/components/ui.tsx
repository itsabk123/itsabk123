import Link from "next/link";
import type { ReactNode } from "react";

export function PageHeader({ eyebrow, title, sub, actions }: { eyebrow?: string; title: string; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <div className="eyebrow mb-2">{eyebrow}</div>}
        <h1 className="h2">{title}</h1>
        {sub && <div className="mt-2 max-w-2xl text-muted">{sub}</div>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Empty({ title, body, action }: { title: string; body?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-line bg-white/60 px-6 py-10 text-center">
      <div className="h3">{title}</div>
      {body && <p className="mx-auto mt-1 max-w-md text-sm text-muted">{body}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

export function Stat({ label, value, note }: { label: string; value: ReactNode; note?: ReactNode }) {
  return (
    <div className="card-pad">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {note && <div className="mt-1 text-xs text-muted">{note}</div>}
    </div>
  );
}

export function Field({ label, name, hint, children }: { label: string; name?: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div>
      <label className="label" htmlFor={name}>{label}</label>
      {children}
      {hint && <p className="hint">{hint}</p>}
    </div>
  );
}

export function Checks({ name, options, selected = [], labels }: { name: string; options: readonly string[]; selected?: string[]; labels?: Record<string, string> }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <label key={o} className="check">
          <input type="checkbox" name={name} value={o} defaultChecked={selected.includes(o)} />
          {labels?.[o] ?? o}
        </label>
      ))}
    </div>
  );
}

export function Select({ name, options, value, placeholder, labels, required }: { name: string; options: readonly string[]; value?: string | null; placeholder?: string; labels?: Record<string, string>; required?: boolean }) {
  return (
    <select id={name} name={name} defaultValue={value ?? ""} className="input" required={required}>
      <option value="">{placeholder ?? "Select…"}</option>
      {options.map((o) => (
        <option key={o} value={o}>{labels?.[o] ?? o}</option>
      ))}
    </select>
  );
}

export function Flash({ sp }: { sp: { ok?: string; err?: string } }) {
  if (!sp.ok && !sp.err) return null;
  return (
    <div role="status" className={`mb-6 rounded-xl border px-4 py-3 text-sm ${sp.err ? "border-bad/30 bg-[#FBEBEA] text-bad" : "border-ok/30 bg-[#EAF4EE] text-ok"}`}>
      {sp.err ?? sp.ok}
    </div>
  );
}

export function Tabs({ items, active }: { items: { href: string; label: string; count?: number }[]; active: string }) {
  return (
    <nav className="-mx-4 mb-6 flex gap-1 overflow-x-auto border-b border-line px-4 sm:mx-0 sm:px-0">
      {items.map((i) => (
        <Link key={i.href} href={i.href} className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm no-underline ${active === i.href ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink"}`}>
          {i.label}
          {i.count !== undefined && <span className="ml-1.5 text-xs text-muted">{i.count}</span>}
        </Link>
      ))}
    </nav>
  );
}

export function SourceTag({ source }: { source: string }) {
  const map: Record<string, [string, string]> = {
    API_VERIFIED: ["badge-ok", "Verified"],
    CREATOR_REPORTED: ["badge", "Self-reported"],
    ADVERTISER_REPORTED: ["badge-accent", "Advertiser-reported"],
    PLATFORM_ESTIMATED: ["badge-warn", "Estimate"],
  };
  const [cls, label] = map[source] ?? ["badge", source];
  return <span className={cls} title="Source of this figure">{label}</span>;
}

export function Avatar({ src, name, size = 48 }: { src?: string | null; name: string; size?: number }) {
  const initials = name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  if (src)
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" width={size} height={size} loading="lazy" className="shrink-0 rounded-full border border-line object-cover" style={{ width: size, height: size }} />;
  return (
    <div aria-hidden className="flex shrink-0 items-center justify-center rounded-full bg-paper-deep font-serif text-ink" style={{ width: size, height: size, fontSize: size / 2.6 }}>
      {initials}
    </div>
  );
}

export function ScoreRing({ score }: { score: number }) {
  const tone = score >= 75 ? "text-ok" : score >= 55 ? "text-ink" : "text-muted";
  return (
    <div className={`flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-full border border-line bg-paper ${tone}`} title="Match score">
      <span className="font-serif text-base leading-none">{score}</span>
    </div>
  );
}
