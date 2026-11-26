import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/time";
import { Markdown } from "@/components/markdown";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const p = await db.post.findUnique({ where: { slug: (await params).slug } });
  if (!p || p.status !== "PUBLISHED") return {};
  return { title: p.title, description: p.excerpt ?? undefined, alternates: { canonical: `/blog/${p.slug}` }, openGraph: { type: "article", title: p.title } };
}

export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  const p = await db.post.findUnique({ where: { slug: (await params).slug } });
  if (!p || p.status !== "PUBLISHED") notFound();
  const ld = { "@context": "https://schema.org", "@type": "Article", headline: p.title, datePublished: p.publishedAt?.toISOString(), author: p.authorName ? { "@type": "Person", name: p.authorName } : undefined };
  return (
    <article className="page max-w-3xl py-14">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      <div className="text-xs text-muted">{formatDate(p.publishedAt)}{p.authorName ? ` · ${p.authorName}` : ""}</div>
      <h1 className="h1 mt-2 !text-4xl">{p.title}</h1>
      {p.excerpt && <p className="lead mt-4">{p.excerpt}</p>}
      <div className="mt-10"><Markdown text={p.body} /></div>
    </article>
  );
}
