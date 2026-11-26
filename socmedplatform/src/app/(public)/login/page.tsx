import Link from "next/link";
import { redirect } from "next/navigation";
import { login } from "@/app/auth-actions";
import { getCurrentUser } from "@/lib/auth";
import { Flash } from "@/components/ui";

export const metadata = { title: "Log in", robots: { index: false } };

export default async function Login({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  if (await getCurrentUser()) redirect(sp.next || "/app");
  return (
    <div className="page max-w-md py-14">
      <h1 className="h2">Log in</h1>
      <div className="mt-6"><Flash sp={sp} /></div>
      <form action={login} className="card-pad space-y-4">
        <div><label className="label" htmlFor="email">Email</label><input id="email" name="email" type="email" required className="input" defaultValue={sp.email} autoComplete="email" /></div>
        <div><label className="label" htmlFor="password">Password</label><input id="password" name="password" type="password" required className="input" autoComplete="current-password" /></div>
        <input type="hidden" name="next" value={sp.next ?? ""} />
        <button className="btn-primary w-full">Log in</button>
        <div className="flex justify-between text-sm"><Link href="/forgot-password" className="link">Forgot password?</Link><Link href="/signup" className="link">Create account</Link></div>
      </form>
    </div>
  );
}
