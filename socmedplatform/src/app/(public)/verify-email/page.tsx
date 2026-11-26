import Link from "next/link";
import { verifyEmailToken } from "@/app/auth-actions";
export const metadata = { title: "Verify email", robots: { index: false } };
export default async function Verify({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const ok = sp.token ? await verifyEmailToken(sp.token) : false;
  return (
    <div className="page max-w-md py-20 text-center">
      <h1 className="h2">{ok ? "Email confirmed" : "Link invalid or expired"}</h1>
      <p className="mt-2 text-muted">{ok ? "Thanks — you can now send proposals and make payments." : "Request a new link from your dashboard."}</p>
      <Link href="/app" className="btn-primary mt-6">Go to dashboard</Link>
    </div>
  );
}
