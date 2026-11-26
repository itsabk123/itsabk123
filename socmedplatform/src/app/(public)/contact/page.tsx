import { Flash } from "@/components/ui";
import { submitContact } from "./actions";
export const metadata = { title: "Contact", description: "Talk to the team — partnerships, assisted matchmaking, support and press." };
export default async function Contact({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string; topic?: string }> }) {
  const sp = await searchParams;
  return (
    <div className="page max-w-2xl py-14">
      <h1 className="h1 !text-4xl">Contact us</h1>
      <p className="lead mt-4">Partnerships, assisted matchmaking, support or press. We reply within two business days (UAE).</p>
      <div className="mt-8"><Flash sp={sp} /></div>
      <form action={submitContact} className="card-pad space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className="label" htmlFor="name">Name</label><input id="name" name="name" required className="input" maxLength={120} /></div>
          <div><label className="label" htmlFor="email">Email</label><input id="email" name="email" type="email" required className="input" maxLength={200} /></div>
        </div>
        <div><label className="label" htmlFor="topic">Topic</label>
          <select id="topic" name="topic" className="input" defaultValue={sp.topic ?? "general"}>
            <option value="general">General</option><option value="matchmaking">Assisted matchmaking</option><option value="managed">Managed campaigns</option><option value="support">Account support</option><option value="partnership">Partnerships</option><option value="press">Press</option><option value="privacy">Privacy / data request</option>
          </select>
        </div>
        <div><label className="label" htmlFor="body">Message</label><textarea id="body" name="body" required className="input" maxLength={4000} /></div>
        <input type="text" name="website" className="hidden" tabIndex={-1} autoComplete="off" aria-hidden />
        <button className="btn-primary">Send message</button>
      </form>
    </div>
  );
}
