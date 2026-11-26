import { PostList } from "@/components/post-list";

export const metadata = { title: "Success stories", description: "Case studies from real collaborations on the platform." };
export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <div className="page max-w-3xl py-14">
      <h1 className="h1 !text-4xl">Success stories</h1>
      <p className="lead mt-4 mb-10">Case studies from real collaborations on the platform.</p>
      <PostList kind="SUCCESS_STORY" emptyTitle="No case studies yet" emptyBody="We only publish case studies from real, completed collaborations with both parties' permission. The first ones will appear here." />
    </div>
  );
}
