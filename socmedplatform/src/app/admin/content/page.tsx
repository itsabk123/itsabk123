import { db } from "@/lib/db";
import { Flash, PageHeader } from "@/components/ui";
import { formatDate } from "@/lib/time";
import { markContactHandled, savePost } from "../actions";

export default async function Content({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const [posts, messages] = await Promise.all([db.post.findMany({ orderBy: { updatedAt: "desc" } }), db.contactMessage.findMany({ where: { handled: false }, orderBy: { createdAt: "asc" } })]);
  const editing = sp.edit ? posts.find((p) => p.id === sp.edit) : null;
  return (
    <div className="space-y-8">
      <PageHeader title="Content" sub="Blog, resources, FAQs and success stories. Only publish success stories from real collaborations, with both parties' written permission." />
      <Flash sp={sp} />
      <form action={savePost} className="card-pad space-y-3">
        <h2 className="h3">{editing ? "Edit post" : "New post"}</h2>
        <input type="hidden" name="id" value={editing?.id ?? ""} />
        <div className="grid gap-3 sm:grid-cols-4">
          <select name="kind" defaultValue={editing?.kind ?? "BLOG"} className="input"><option value="BLOG">Blog</option><option value="RESOURCE">Resource</option><option value="SUCCESS_STORY">Success story</option><option value="FAQ">FAQ</option></select>
          <input name="title" defaultValue={editing?.title} className="input sm:col-span-2" placeholder="Title" required />
          <input name="slug" defaultValue={editing?.slug} className="input" placeholder="slug (optional)" />
        </div>
        <input name="excerpt" defaultValue={editing?.excerpt ?? ""} className="input" placeholder="Excerpt / meta description" />
        <textarea name="body" defaultValue={editing?.body} className="input font-mono text-sm" rows={12} placeholder="Markdown: ## headings, - lists, **bold**, [links](https://…)" required />
        <div className="flex flex-wrap gap-2"><input name="authorName" defaultValue={editing?.authorName ?? ""} className="input !w-56" placeholder="Author" /><select name="status" defaultValue={editing?.status ?? "DRAFT"} className="input !w-40"><option>DRAFT</option><option>PUBLISHED</option></select><button className="btn-primary">Save</button></div>
      </form>
      <section className="card overflow-x-auto"><table className="table">
        <thead><tr><th>Title</th><th>Kind</th><th>Status</th><th>Updated</th></tr></thead>
        <tbody>{posts.map((p) => <tr key={p.id}><td><a href={`/admin/content?edit=${p.id}`} className="link">{p.title}</a></td><td>{p.kind.toLowerCase()}</td><td>{p.status.toLowerCase()}</td><td className="text-muted">{formatDate(p.updatedAt)}</td></tr>)}</tbody>
      </table></section>
      <section>
        <h2 className="h3 mb-3">Contact inbox ({messages.length})</h2>
        <div className="space-y-2">{messages.map((m) => (
          <form key={m.id} action={markContactHandled} className="card-pad text-sm"><input type="hidden" name="id" value={m.id} />
            <div className="flex justify-between"><span className="font-medium text-ink">{m.name} · <a href={`mailto:${m.email}`} className="link">{m.email}</a> · {m.topic}</span><span className="text-xs text-muted">{formatDate(m.createdAt)}</span></div>
            <p className="mt-1 whitespace-pre-line">{m.body}</p><button className="btn-ghost btn-sm mt-2">Mark handled</button></form>
        ))}</div>
      </section>
    </div>
  );
}
