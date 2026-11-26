"use server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getActingContext, canActFor } from "@/lib/access";
import { str } from "@/lib/forms";
import { rateLimit } from "@/lib/rate-limit";
import { spamScore } from "@/lib/fraud";
import { notifyProfile } from "@/lib/notify";

export async function startConversation(fd: FormData) {
  const user = await requireUser();
  const ctx = await getActingContext();
  if (!ctx?.acting) redirect("/app/onboarding");
  const to = str(fd, "to");
  if (to === ctx.acting.id) redirect("/app/messages");
  const blocked = await db.block.findFirst({ where: { OR: [{ blockerProfileId: to, blockedProfileId: ctx.acting.id }, { blockerProfileId: ctx.acting.id, blockedProfileId: to }] } });
  if (blocked) redirect("/app/messages?err=You+can%27t+message+this+profile");
  const existing = await db.conversation.findFirst({
    where: { dealId: null, AND: [{ participants: { some: { profileId: ctx.acting.id } } }, { participants: { some: { profileId: to } } }] },
  });
  if (existing) redirect(`/app/messages/${existing.id}`);
  if (!(await rateLimit(`newconvo:${user.id}`, 20, 86400))) redirect("/app/messages?err=Daily+new-conversation+limit+reached");
  const c = await db.conversation.create({ data: { participants: { create: [{ profileId: ctx.acting.id, lastReadAt: new Date() }, { profileId: to }] } } });
  redirect(`/app/messages/${c.id}`);
}

export async function sendMessage(fd: FormData) {
  const user = await requireUser();
  const conversationId = str(fd, "conversationId");
  const body = str(fd, "body", 5000);
  const back = str(fd, "back") || `/app/messages/${conversationId}`;
  if (!body) redirect(back);
  const parts = await db.conversationParticipant.findMany({ where: { conversationId } });
  const mine = [];
  for (const p of parts) if (await canActFor(user.id, p.profileId)) mine.push(p);
  if (!mine.length) redirect("/app/messages?err=Not+authorised");
  const sender = mine[0];
  if (!(await rateLimit(`msg:${user.id}`, 120, 3600))) redirect(`${back}?err=Slow+down+a+little`);
  const recentSame = await db.message.count({ where: { senderUserId: user.id, body, createdAt: { gte: new Date(Date.now() - 86400_000) } } });
  const score = spamScore(body, recentSame);
  const others = parts.filter((p) => p.profileId !== sender.profileId);
  const blocked = await db.block.findFirst({ where: { blockerProfileId: { in: others.map((o) => o.profileId) }, blockedProfileId: sender.profileId } });
  if (blocked) redirect(`${back}?err=This+person+isn%27t+accepting+messages+from+you`);
  await db.message.create({ data: { conversationId, senderProfileId: sender.profileId, senderUserId: user.id, body, flaggedSpam: score >= 0.7, attachmentUrl: str(fd, "attachmentUrl", 500) || null } });
  await db.conversation.update({ where: { id: conversationId }, data: { lastMessageAt: new Date() } });
  await db.conversationParticipant.update({ where: { id: sender.id }, data: { lastReadAt: new Date() } });
  if (score >= 0.7) {
    await db.fraudFlag.upsert({ where: { profileId_kind: { profileId: sender.profileId, kind: "SPAM_MESSAGES" } }, create: { profileId: sender.profileId, kind: "SPAM_MESSAGES", details: "Messages matched spam heuristics", score }, update: { score } });
  } else {
    const senderProfile = await db.profile.findUnique({ where: { id: sender.profileId }, select: { displayName: true } });
    for (const o of others) await notifyProfile(o.profileId, "messages", { title: `New message from ${senderProfile?.displayName}`, body: body.slice(0, 140), link: `/app/messages/${conversationId}` });
  }
  redirect(back);
}

export async function blockProfile(fd: FormData) {
  const user = await requireUser();
  const ctx = await getActingContext();
  const target = str(fd, "target");
  if (!ctx?.acting || !target) redirect("/app/messages");
  await db.block.upsert({ where: { blockerProfileId_blockedProfileId: { blockerProfileId: ctx.acting.id, blockedProfileId: target } }, create: { blockerProfileId: ctx.acting.id, blockedProfileId: target }, update: {} });
  void user;
  redirect("/app/messages?ok=Blocked.+They+can+no+longer+message+or+invite+you.");
}
