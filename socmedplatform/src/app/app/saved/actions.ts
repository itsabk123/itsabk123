"use server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getActingContext } from "@/lib/access";
import { str } from "@/lib/forms";
import { rateLimit } from "@/lib/rate-limit";

const safe = (b: string, fallback: string) => (b.startsWith("/") && !b.startsWith("//") ? b : fallback);

export async function toggleSave(fd: FormData) {
  const user = await requireUser();
  const profileId = str(fd, "profileId");
  const listName = str(fd, "listName", 60) || "Saved";
  const existing = await db.savedProfile.findFirst({ where: { userId: user.id, profileId } });
  if (existing) await db.savedProfile.delete({ where: { id: existing.id } });
  else if (await db.profile.findUnique({ where: { id: profileId } })) {
    await db.savedProfile.create({ data: { userId: user.id, profileId, listName } });
    const ctx = await getActingContext();
    if (ctx?.acting) {
      await db.matchFeedback.upsert({ where: { sourceProfileId_targetProfileId_signal: { sourceProfileId: ctx.acting.id, targetProfileId: profileId, signal: "SAVE" } }, create: { userId: user.id, sourceProfileId: ctx.acting.id, targetProfileId: profileId, signal: "SAVE" }, update: {} });
      // Notify the saved profile's owners (shortlisting is a useful retention signal) without revealing who, unless they choose to contact.
    }
  }
  redirect(safe(str(fd, "back"), "/app/saved"));
}

export async function moveSaved(fd: FormData) {
  const user = await requireUser();
  await db.savedProfile.updateMany({ where: { id: str(fd, "id"), userId: user.id }, data: { listName: str(fd, "listName", 60) || "Saved" } });
  redirect("/app/saved");
}

export async function saveSearch(fd: FormData) {
  const user = await requireUser();
  const scope = str(fd, "scope", 30);
  const query = str(fd, "query", 1000);
  const count = await db.savedSearch.count({ where: { userId: user.id } });
  if (count >= 25) redirect("/app/saved?err=You+can+save+up+to+25+searches");
  await db.savedSearch.create({ data: { userId: user.id, scope, query, name: str(fd, "name", 120) || `Saved ${scope} search` } });
  redirect("/app/saved?ok=Search+saved.+We%27ll+alert+you+to+new+matches.");
}

export async function deleteSearch(fd: FormData) {
  const user = await requireUser();
  await db.savedSearch.deleteMany({ where: { id: str(fd, "id"), userId: user.id } });
  redirect("/app/saved");
}

export async function toggleSearchAlert(fd: FormData) {
  const user = await requireUser();
  const s = await db.savedSearch.findFirst({ where: { id: str(fd, "id"), userId: user.id } });
  if (s) await db.savedSearch.update({ where: { id: s.id }, data: { alert: !s.alert } });
  redirect("/app/saved");
}

export async function hideMatch(fd: FormData) {
  const user = await requireUser();
  const ctx = await getActingContext();
  const target = str(fd, "target");
  if (ctx?.acting && target) {
    await db.matchFeedback.upsert({
      where: { sourceProfileId_targetProfileId_signal: { sourceProfileId: ctx.acting.id, targetProfileId: target, signal: "HIDE" } },
      create: { userId: user.id, sourceProfileId: ctx.acting.id, targetProfileId: target, signal: "HIDE" },
      update: {},
    });
  }
  redirect("/app?ok=Hidden+from+your+recommendations");
}

export async function reportTarget(fd: FormData) {
  const user = await requireUser();
  if (!(await rateLimit(`report:${user.id}`, 10, 3600))) redirect("/app?err=Too+many+reports");
  const targetType = str(fd, "targetType", 20);
  if (!["PROFILE", "CAMPAIGN", "MESSAGE", "REVIEW"].includes(targetType)) redirect("/app");
  await db.report.create({ data: { reporterUserId: user.id, targetType, targetId: str(fd, "targetId", 40), reason: str(fd, "reason", 120) || "Other", details: str(fd, "details", 2000) || null } });
  redirect(`${safe(str(fd, "back"), "/app")}?ok=Thanks+%E2%80%94+our+team+will+review+this.`);
}
