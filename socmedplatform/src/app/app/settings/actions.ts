"use server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { destroySession, hashPassword, passwordProblem, requireUser, verifyPassword } from "@/lib/auth";
import { bool, str } from "@/lib/forms";
import { audit } from "@/lib/audit";
import { randomToken } from "@/lib/crypto";

export async function updateAccount(fd: FormData) {
  const user = await requireUser();
  const tz = str(fd, "timezone", 60);
  let validTz = user.timezone;
  try { new Intl.DateTimeFormat("en", { timeZone: tz }); validTz = tz; } catch {}
  await db.user.update({ where: { id: user.id }, data: { name: str(fd, "name", 120) || user.name, phone: str(fd, "phone", 30) || null, timezone: validTz, locale: str(fd, "locale") === "ar" ? "ar" : "en", marketingOptIn: bool(fd, "marketingOptIn") } });
  redirect("/app/settings?ok=Saved");
}

export async function changePassword(fd: FormData) {
  const user = await requireUser();
  if (!(await verifyPassword(String(fd.get("current") ?? ""), user.passwordHash))) redirect("/app/settings?err=Current+password+is+incorrect");
  const pw = String(fd.get("password") ?? "");
  const problem = passwordProblem(pw);
  if (problem) redirect(`/app/settings?err=${encodeURIComponent(problem)}`);
  await db.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(pw) } });
  await audit(user.id, "auth.password_change", { type: "User", id: user.id });
  redirect("/app/settings?ok=Password+changed");
}

export async function saveNotificationPrefs(fd: FormData) {
  const user = await requireUser();
  for (const g of ["deals", "messages", "bookings", "payments", "opportunities", "marketing"]) {
    await db.notificationPreference.upsert({
      where: { userId_type: { userId: user.id, type: g } },
      create: { userId: user.id, type: g, inApp: bool(fd, `${g}_inApp`), email: bool(fd, `${g}_email`) },
      update: { inApp: bool(fd, `${g}_inApp`), email: bool(fd, `${g}_email`) },
    });
  }
  redirect("/app/settings?ok=Preferences+saved#notifications");
}

export async function signOutEverywhere() {
  const user = await requireUser();
  await db.session.deleteMany({ where: { userId: user.id } });
  redirect("/login?ok=Signed+out+of+all+devices");
}

/**
 * Account deletion: personal data is erased or anonymised. Financial records (payments, invoices) are retained
 * as required by law but detached from identifying details. Active paid deals block deletion.
 */
export async function deleteAccount(fd: FormData) {
  const user = await requireUser();
  if (str(fd, "confirm") !== "DELETE") redirect("/app/settings?err=Type+DELETE+to+confirm");
  const profiles = await db.profile.findMany({ where: { ownerUserId: user.id }, select: { id: true } });
  const ids = profiles.map((p) => p.id);
  const active = await db.deal.count({ where: { OR: [{ initiatorProfileId: { in: ids } }, { recipientProfileId: { in: ids } }], status: { in: ["CONTRACTED", "FUNDED", "IN_PROGRESS", "DELIVERED", "DISPUTED"] } } });
  if (active) redirect("/app/settings?err=Finish+or+cancel+your+active+deals+before+deleting+your+account");
  await db.$transaction([
    db.profile.updateMany({ where: { id: { in: ids } }, data: { status: "HIDDEN", visibility: "PRIVATE", displayName: "Deleted user", bio: null, headline: null, avatarUrl: null, coverUrl: null, contactEmail: null, website: null, links: undefined, indexable: false } }),
    db.socialAccount.deleteMany({ where: { profileId: { in: ids } } }),
    db.audienceSlice.deleteMany({ where: { profileId: { in: ids } } }),
    db.savedProfile.deleteMany({ where: { userId: user.id } }),
    db.savedSearch.deleteMany({ where: { userId: user.id } }),
    db.notification.deleteMany({ where: { userId: user.id } }),
    db.session.deleteMany({ where: { userId: user.id } }),
    db.user.update({ where: { id: user.id }, data: { status: "DELETED", email: `deleted-${user.id}@invalid`, name: "Deleted user", phone: null, passwordHash: randomToken(), marketingOptIn: false } }),
  ]);
  await audit(user.id, "account.delete", { type: "User", id: user.id });
  await destroySession();
  redirect("/?ok=Account+deleted");
}
