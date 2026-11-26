import { requestReset } from "@/app/auth-actions";
import { Flash } from "@/components/ui";
export const metadata = { title: "Reset password", robots: { index: false } };
export default async function Forgot({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  return (
    <div className="page max-w-md py-14">
      <h1 className="h2">Reset your password</h1>
      <div className="mt-6"><Flash sp={sp} /></div>
      <form action={requestReset} className="card-pad space-y-4">
        <div><label className="label" htmlFor="email">Email</label><input id="email" name="email" type="email" required className="input" /></div>
        <button className="btn-primary w-full">Send reset link</button>
      </form>
    </div>
  );
}
