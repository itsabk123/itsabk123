import { requireActing } from "@/lib/access";
import { PageHeader } from "@/components/ui";
import { DraftButton } from "@/components/draft-button";

const TOOLS = [
  ["bio", "Profile bio", "A professional bio from your profile facts."],
  ["campaign_brief", "Campaign brief", "A structured creator brief with disclosure reminder."],
  ["pitch", "Pitch / proposal message", "A short, specific outreach message."],
  ["interview_questions", "Interview questions", "Questions for a guest, grouped opening → depth → close."],
  ["sponsorship_proposal", "Sponsorship proposal", "An outline for a podcast to send a brand."],
  ["follow_up", "Follow-up", "A polite nudge on an earlier proposal."],
] as const;

export default async function Assistant() {
  const { acting } = await requireActing();
  return (
    <div className="max-w-3xl">
      <PageHeader title="Writing assistant" sub={`Drafts based on ${acting.displayName}'s profile. Always review before you use them — drafts never invent statistics or clients, and nothing is sent or published automatically.`} />
      <div className="space-y-6">
        {TOOLS.map(([k, t, d]) => (
          <section key={k} className="card-pad space-y-3">
            <div><div className="h3">{t}</div><p className="text-sm text-muted">{d}</p></div>
            <textarea id={`out-${k}`} className="input" rows={6} placeholder="Your draft will appear here." />
            <DraftButton kind={k} profileId={acting.id} target={`out-${k}`} />
          </section>
        ))}
      </div>
    </div>
  );
}
