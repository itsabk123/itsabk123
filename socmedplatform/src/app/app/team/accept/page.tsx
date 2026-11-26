import Link from "next/link";
import { acceptInvite } from "../actions";

export default async function Accept({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const err = sp.token ? await acceptInvite(sp.token) : "Missing invitation token.";
  return (
    <div className="max-w-md py-10">
      <h1 className="h2">{err ? "Couldn't accept invitation" : "You've joined the team"}</h1>
      <p className="mt-2 text-muted">{err ?? "You can now act for this organization's profiles from the profile switcher."}</p>
      <Link href="/app/team" className="btn-primary mt-6">Go to team</Link>
    </div>
  );
}
