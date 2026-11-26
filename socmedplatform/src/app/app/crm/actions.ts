"use server";
import { redirect } from "next/navigation";
import type { CrmStage } from "@prisma/client";
import { db } from "@/lib/db";
import { requireActing } from "@/lib/access";
import { date, optStr, str } from "@/lib/forms";

const STAGES: CrmStage[] = ["NEW_LEAD", "CONTACTED", "INTERESTED", "NEGOTIATING", "BOOKED", "COMPLETED", "REPEAT_CLIENT", "NOT_INTERESTED"];

export async function updateContact(fd: FormData) {
  const { acting } = await requireActing();
  const stage = str(fd, "stage") as CrmStage;
  await db.crmContact.updateMany({
    where: { id: str(fd, "id"), ownerProfileId: acting.id },
    data: { ...(STAGES.includes(stage) ? { stage } : {}), notes: optStr(fd, "notes", 3000), nextFollowUpAt: date(fd, "nextFollowUpAt") },
  });
  redirect("/app/crm?ok=Saved");
}

export async function addContact(fd: FormData) {
  const { acting } = await requireActing();
  const target = await db.profile.findUnique({ where: { slug: str(fd, "slug").replace(/^.*\/p\//, "") } });
  if (!target || target.id === acting.id) redirect("/app/crm?err=Profile+not+found");
  await db.crmContact.upsert({ where: { ownerProfileId_contactProfileId: { ownerProfileId: acting.id, contactProfileId: target.id } }, create: { ownerProfileId: acting.id, contactProfileId: target.id }, update: {} });
  redirect("/app/crm?ok=Added");
}
