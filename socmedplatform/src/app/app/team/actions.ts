"use server";
import { redirect } from "next/navigation";
import type { OrgRole } from "@prisma/client";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { str } from "@/lib/forms";
import { randomToken, sha256 } from "@/lib/crypto";
import { notifyUser, queueEmail } from "@/lib/notify";
import { audit } from "@/lib/audit";
import { uniqueSlug } from "@/lib/slug";

const ROLES: OrgRole[] = ["OWNER", "ADMIN", "MANAGER", "MEMBER", "VIEWER"];

async function requireOrgAdmin(orgId: string) {
  const user = await requireUser();
  const m = await db.organizationMember.findUnique({ where: { organizationId_userId: { organizationId: orgId, userId: user.id } } });
  if (!m || !["OWNER", "ADMIN"].includes(m.role)) redirect("/app/team?err=Only+owners+and+admins+can+manage+the+team");
  return { user, m };
}

export async function createOrg(fd: FormData) {
  const user = await requireUser();
  const name = str(fd, "name", 120);
  const type = str(fd, "type") === "AGENCY" ? "AGENCY" : str(fd, "type") === "STUDIO" ? "STUDIO" : "BRAND";
  if (!name) redirect("/app/team?err=Name+required");
  await db.organization.create({ data: { name, type, slug: uniqueSlug(name), members: { create: { userId: user.id, role: "OWNER" } } } });
  redirect("/app/team?ok=Organization+created");
}

export async function inviteMember(fd: FormData) {
  const orgId = str(fd, "orgId");
  const { user } = await requireOrgAdmin(orgId);
  const email = str(fd, "email", 200).toLowerCase();
  const role = (ROLES.includes(str(fd, "role") as OrgRole) ? str(fd, "role") : "MEMBER") as OrgRole;
  if (!/^\S+@\S+\.\S+$/.test(email) || role === "OWNER") redirect("/app/team?err=Enter+a+valid+email+and+role");
  const org = await db.organization.findUniqueOrThrow({ where: { id: orgId } });
  const token = randomToken();
  await db.authToken.create({ data: { type: "ORG_INVITE", tokenHash: sha256(token), email, meta: { orgId, role, invitedBy: user.id }, expiresAt: new Date(Date.now() + 7 * 86400_000) } });
  const link = `${process.env.APP_URL ?? ""}/app/team/accept?token=${token}`;
  await queueEmail(email, `Join ${org.name} on the marketplace`, `${user.name} invited you to join ${org.name} as ${role.toLowerCase()}.\nAccept: ${link}`);
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) await notifyUser(existing.id, "account", { title: `Invitation to join ${org.name}`, link: `/app/team/accept?token=${token}` });
  await audit(user.id, "org.invite", { type: "Organization", id: orgId }, { email, role });
  redirect("/app/team?ok=Invitation+sent");
}

export async function acceptInvite(token: string) {
  const user = await requireUser();
  const t = await db.authToken.findUnique({ where: { tokenHash: sha256(token) } });
  if (!t || t.type !== "ORG_INVITE" || t.usedAt || t.expiresAt < new Date()) return "This invitation is invalid or has expired.";
  if (t.email && t.email !== user.email) return "This invitation was sent to a different email address.";
  const meta = t.meta as { orgId: string; role: OrgRole };
  await db.organizationMember.upsert({ where: { organizationId_userId: { organizationId: meta.orgId, userId: user.id } }, create: { organizationId: meta.orgId, userId: user.id, role: meta.role }, update: { role: meta.role } });
  await db.authToken.update({ where: { id: t.id }, data: { usedAt: new Date() } });
  await audit(user.id, "org.join", { type: "Organization", id: meta.orgId });
  return null;
}

export async function changeRole(fd: FormData) {
  const orgId = str(fd, "orgId");
  const { user, m } = await requireOrgAdmin(orgId);
  const role = str(fd, "role") as OrgRole;
  const target = await db.organizationMember.findUnique({ where: { id: str(fd, "memberId") } });
  if (!target || target.organizationId !== orgId || !ROLES.includes(role)) redirect("/app/team");
  if ((role === "OWNER" || target.role === "OWNER") && m.role !== "OWNER") redirect("/app/team?err=Only+an+owner+can+change+ownership");
  if (target.role === "OWNER" && role !== "OWNER") {
    const owners = await db.organizationMember.count({ where: { organizationId: orgId, role: "OWNER" } });
    if (owners <= 1) redirect("/app/team?err=An+organization+needs+at+least+one+owner");
  }
  await db.organizationMember.update({ where: { id: target.id }, data: { role } });
  await audit(user.id, "org.role_change", { type: "Organization", id: orgId }, { member: target.userId, role });
  redirect("/app/team?ok=Role+updated");
}

export async function removeMember(fd: FormData) {
  const orgId = str(fd, "orgId");
  const { user, m } = await requireOrgAdmin(orgId);
  const target = await db.organizationMember.findUnique({ where: { id: str(fd, "memberId") } });
  if (!target || target.organizationId !== orgId) redirect("/app/team");
  if (target.role === "OWNER" && m.role !== "OWNER") redirect("/app/team?err=Only+an+owner+can+remove+an+owner");
  const owners = await db.organizationMember.count({ where: { organizationId: orgId, role: "OWNER" } });
  if (target.role === "OWNER" && owners <= 1) redirect("/app/team?err=An+organization+needs+at+least+one+owner");
  await db.organizationMember.delete({ where: { id: target.id } });
  await audit(user.id, "org.remove", { type: "Organization", id: orgId }, { member: target.userId });
  redirect("/app/team?ok=Removed");
}

/** Consent-based representation: only the profile OWNER can grant an agency management rights. */
export async function grantManagement(fd: FormData) {
  const user = await requireUser();
  const profile = await db.profile.findUnique({ where: { id: str(fd, "profileId") } });
  if (!profile || profile.ownerUserId !== user.id) redirect("/app/team?err=Only+the+profile+owner+can+do+this");
  const slug = str(fd, "orgSlug", 80);
  if (!slug) {
    await db.profile.update({ where: { id: profile.id }, data: { managedByOrgId: null } });
    await audit(user.id, "profile.management_revoked", { type: "Profile", id: profile.id });
    redirect("/app/team?ok=Management+access+removed");
  }
  const org = await db.organization.findUnique({ where: { slug } });
  if (!org || org.type === "BRAND") redirect("/app/team?err=Agency+not+found");
  await db.profile.update({ where: { id: profile.id }, data: { managedByOrgId: org.id } });
  await audit(user.id, "profile.management_granted", { type: "Profile", id: profile.id }, { orgId: org.id });
  redirect(`/app/team?ok=${encodeURIComponent(`${org.name} can now manage ${profile.displayName}`)}`);
}
