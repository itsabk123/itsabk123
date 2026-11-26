import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "./db";
import { getCurrentUser, requireUser } from "./auth";
import type { OrgRole, Profile, User } from "@prisma/client";

const WRITE_ROLES: OrgRole[] = ["OWNER", "ADMIN", "MANAGER"];

/**
 * Tenant isolation: a user can act for a profile if they own it, or hold a
 * manager-level role in the organization that owns or manages it.
 */
export async function accessibleProfiles(userId: string, opts: { write?: boolean } = { write: true }) {
  const memberships = await db.organizationMember.findMany({ where: { userId }, select: { organizationId: true, role: true } });
  const orgIds = memberships.filter((m) => !opts.write || WRITE_ROLES.includes(m.role)).map((m) => m.organizationId);
  return db.profile.findMany({
    where: {
      status: { not: "SUSPENDED" },
      OR: [{ ownerUserId: userId }, { organizationId: { in: orgIds } }, { managedByOrgId: { in: orgIds } }],
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function canActFor(userId: string, profileId: string, write = true) {
  const list = await accessibleProfiles(userId, { write });
  return list.some((p) => p.id === profileId);
}

export const getActingContext = cache(async (): Promise<{ user: User; profiles: Profile[]; acting: Profile | null } | null> => {
  const user = await getCurrentUser();
  if (!user) return null;
  const profiles = await accessibleProfiles(user.id);
  const wanted = (await cookies()).get("mj_profile")?.value;
  const acting = profiles.find((p) => p.id === wanted) ?? profiles[0] ?? null;
  return { user, profiles, acting };
});

/** For pages that need a profile to act as. Sends new users to onboarding. */
export async function requireActing(next = "/app") {
  await requireUser(next);
  const ctx = await getActingContext();
  if (!ctx || !ctx.acting) redirect("/app/onboarding");
  return ctx as { user: User; profiles: Profile[]; acting: Profile };
}

export async function requireProfileAccess(profileId: string) {
  const user = await requireUser();
  if (!(await canActFor(user.id, profileId))) redirect("/app?err=You+do+not+have+access+to+that+profile");
  return user;
}
