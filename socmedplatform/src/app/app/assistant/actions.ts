"use server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { canActFor, getActingContext } from "@/lib/access";
import { draftText, type DraftKind } from "@/lib/ai";
import { rateLimit } from "@/lib/rate-limit";
import { getConfig } from "@/lib/config";
import { languageLabel, OFFERING_KINDS } from "@/lib/taxonomy";

const KINDS: DraftKind[] = ["bio", "campaign_brief", "pitch", "interview_questions", "sponsorship_proposal", "follow_up"];

export async function generateDraft(kind: string, profileId: string, extra: Record<string, string>) {
  const user = await requireUser();
  if (!KINDS.includes(kind as DraftKind)) return { error: "Unknown draft type", text: "", source: "template" as const };
  const features = await getConfig("features");
  if (!features.aiAssist) return { error: "The writing assistant is turned off.", text: "", source: "template" as const };
  if (!(await rateLimit(`ai:${user.id}`, 30, 3600))) return { error: "Hourly limit reached — try again later.", text: "", source: "template" as const };
  const ctx = await getActingContext();
  const pid = profileId || ctx?.acting?.id || "";
  if (pid && !(await canActFor(user.id, pid))) return { error: "Not authorised", text: "", source: "template" as const };
  const p = pid ? await db.profile.findUnique({ where: { id: pid }, include: { guest: true, podcast: true, offerings: true } }) : null;
  const facts: Record<string, string | string[] | null | undefined> = {
    name: p?.displayName,
    title: p?.guest?.professionalTitle ?? p?.headline,
    location: p?.city ?? p?.emirate,
    focus: [p?.industry ?? "", ...(p?.niches ?? []), ...(p?.guest?.topics ?? [])].filter(Boolean),
    languages: p?.languages.map(languageLabel),
    offer: p?.offerings.map((o) => OFFERING_KINDS[o.kind]?.label ?? o.kind),
    show: p?.type === "PODCAST" ? p.displayName : undefined,
    about: p?.bio ?? p?.headline,
    expertise: p?.guest?.expertise,
    sender: p?.displayName,
    senderFocus: p?.headline,
    ...Object.fromEntries(Object.entries(extra).map(([k, v]) => [k, String(v).slice(0, 1000)])),
  };
  const res = await draftText(kind as DraftKind, facts);
  return { ...res, error: null };
}
