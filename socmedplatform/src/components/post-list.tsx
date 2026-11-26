import Link from "next/link";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/time";
import { Empty } from "./ui";

export async function PostList({ kind, emptyTitle, emptyBody }: { kind: string; emptyTitle: string; emptyBody: string }) {
  const posts = await db.post.findMany({ where: { kind, status: "PUBLISHED" }, orderBy: { publishedAt: "desc" }, take: 50 });
  if (!posts.length) return <Empty title={emptyTitle} body={emptyBody} />;
  return (
    <div className="divide-y divide-line border-y border-line">
      {posts.map((p) => (
        <Link key={p.id} href={`/blog/${p.slug}`} className="block py-5 no-underline hover:bg-white/60">
          <div className="text-xs text-muted">{formatDate(p.publishedAt)}{p.authorName ? ` · ${p.authorName}` : ""}</div>
          <div className="h3 mt-1 text-lg">{p.title}</div>
          {p.excerpt && <p className="mt-1 text-sm text-muted">{p.excerpt}</p>}
        </Link>
      ))}
    </div>
  );
}
