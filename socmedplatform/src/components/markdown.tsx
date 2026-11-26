import type { ReactNode } from "react";

/** Minimal, safe Markdown subset (headings, paragraphs, lists, bold, links). No raw HTML is rendered. */
function inline(s: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*([^*]+)\*\*|\[([^\]]+)\]\((https?:\/\/[^)\s]+|\/[^)\s]*)\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(s))) {
    if (m.index > last) out.push(s.slice(last, m.index));
    if (m[2]) out.push(<strong key={i++}>{m[2]}</strong>);
    else out.push(<a key={i++} href={m[4]} className="link" rel={m[4].startsWith("http") ? "nofollow noopener" : undefined}>{m[3]}</a>);
    last = m.index + m[0].length;
  }
  if (last < s.length) out.push(s.slice(last));
  return out;
}

export function Markdown({ text }: { text: string }) {
  const blocks = text.replace(/\r/g, "").split(/\n{2,}/);
  return (
    <div className="space-y-4 text-[15px] leading-7 text-charcoal">
      {blocks.map((b, i) => {
        if (b.startsWith("### ")) return <h3 key={i} className="h3 pt-2">{inline(b.slice(4))}</h3>;
        if (b.startsWith("## ")) return <h2 key={i} className="pt-4 font-serif text-xl text-ink">{inline(b.slice(3))}</h2>;
        if (/^(- |\* )/.test(b)) return <ul key={i} className="list-disc space-y-1 ps-5">{b.split("\n").map((l, j) => <li key={j}>{inline(l.replace(/^(- |\* )/, ""))}</li>)}</ul>;
        if (/^\d+\. /.test(b)) return <ol key={i} className="list-decimal space-y-1 ps-5">{b.split("\n").map((l, j) => <li key={j}>{inline(l.replace(/^\d+\. /, ""))}</li>)}</ol>;
        return <p key={i}>{inline(b)}</p>;
      })}
    </div>
  );
}
