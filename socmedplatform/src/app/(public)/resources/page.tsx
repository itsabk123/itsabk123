import { PostList } from "@/components/post-list";

export const metadata = { title: "Resources", description: "Practical guides on podcast monetisation, creator pricing, campaign measurement and UAE advertising rules." };
export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <div className="page max-w-3xl py-14">
      <h1 className="h1 !text-4xl">Resources</h1>
      <p className="lead mt-4 mb-10">Practical guides on podcast monetisation, creator pricing, campaign measurement and UAE advertising rules.</p>
      <PostList kind="RESOURCE" emptyTitle="Resources are on the way" emptyBody="Our editorial team is preparing guides. Check back soon." />
    </div>
  );
}
