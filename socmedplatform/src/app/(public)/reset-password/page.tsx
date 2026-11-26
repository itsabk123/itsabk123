import { resetPassword } from "@/app/auth-actions";
import { Flash } from "@/components/ui";
export const metadata = { title: "Choose a new password", robots: { index: false } };
export default async function Reset({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  return (
    <div className="page max-w-md py-14">
      <h1 className="h2">Choose a new password</h1>
      <div className="mt-6"><Flash sp={sp} /></div>
      <form action={resetPassword} className="card-pad space-y-4">
        <input type="hidden" name="token" value={sp.token ?? ""} />
        <div><label className="label" htmlFor="password">New password</label><input id="password" name="password" type="password" minLength={10} required className="input" autoComplete="new-password" /></div>
        <button className="btn-primary w-full">Update password</button>
      </form>
    </div>
  );
}
