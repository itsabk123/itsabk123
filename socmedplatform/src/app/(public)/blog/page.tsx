import { PostList } from "@/components/post-list";

export const metadata = { title: "Blog", description: "Insights on the UAE creator economy, podcast advertising and branded content." };
export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <div className="page max-w-3xl py-14">
      <h1 className="h1 !text-4xl">Blog</h1>
      <p className="lead mt-4 mb-10">Insights on the UAE creator economy, podcast advertising and branded content.</p>
      <PostList kind="BLOG" emptyTitle="No posts yet" emptyBody="The first articles will be published here." />
    </div>
  );
}
