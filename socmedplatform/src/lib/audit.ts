import { db } from "./db";
import type { Prisma } from "@prisma/client";

export async function audit(actorUserId: string | null, action: string, target?: { type: string; id: string }, meta?: Prisma.InputJsonValue) {
  await db.auditLog.create({
    data: { actorUserId, action, targetType: target?.type, targetId: target?.id, meta },
  });
}

export async function track(name: string, userId?: string | null, props?: Prisma.InputJsonValue) {
  await db.analyticsEvent.create({ data: { name, userId: userId ?? null, props } });
}
