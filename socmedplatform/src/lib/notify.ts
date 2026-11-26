import { db } from "./db";

export type NotificationGroup = "deals" | "messages" | "bookings" | "payments" | "opportunities" | "account" | "marketing";

const GROUP_DEFAULT_EMAIL: Record<NotificationGroup, boolean> = {
  deals: true, messages: false, bookings: true, payments: true, opportunities: false, account: true, marketing: false,
};

/** Creates an in-app notification and queues an email if the user's preferences allow it. */
export async function notifyUser(
  userId: string,
  group: NotificationGroup,
  n: { title: string; body?: string; link?: string },
) {
  const pref = await db.notificationPreference.findUnique({ where: { userId_type: { userId, type: group } } });
  const inApp = pref?.inApp ?? true;
  const email = pref?.email ?? GROUP_DEFAULT_EMAIL[group];
  if (inApp || group === "account" || group === "payments") {
    await db.notification.create({ data: { userId, type: group, title: n.title, body: n.body, link: n.link } });
  }
  if (email) {
    const user = await db.user.findUnique({ where: { id: userId }, select: { email: true, status: true } });
    if (user && user.status === "ACTIVE") {
      const link = n.link ? `\n\n${process.env.APP_URL ?? ""}${n.link}` : "";
      await queueEmail(user.email, n.title, `${n.body ?? n.title}${link}\n\nManage notifications: ${process.env.APP_URL ?? ""}/app/settings`);
    }
  }
}

/** Notifies every user allowed to act for a profile (owner + org managers). */
export async function notifyProfile(profileId: string, group: NotificationGroup, n: { title: string; body?: string; link?: string }) {
  const p = await db.profile.findUnique({
    where: { id: profileId },
    select: {
      ownerUserId: true,
      organization: { select: { members: { where: { role: { in: ["OWNER", "ADMIN", "MANAGER"] } }, select: { userId: true } } } },
      managedByOrg: { select: { members: { where: { role: { in: ["OWNER", "ADMIN", "MANAGER"] } }, select: { userId: true } } } },
    },
  });
  if (!p) return;
  const ids = new Set<string>([p.ownerUserId]);
  p.organization?.members.forEach((m) => ids.add(m.userId));
  p.managedByOrg?.members.forEach((m) => ids.add(m.userId));
  for (const id of ids) await notifyUser(id, group, n);
}

/**
 * Every email is written to the outbox. If RESEND_API_KEY is configured it is delivered immediately;
 * otherwise it stays as LOGGED so operators can see exactly what would have been sent.
 */
export async function queueEmail(to: string, subject: string, body: string) {
  const row = await db.emailOutbox.create({ data: { to, subject, body, status: process.env.RESEND_API_KEY ? "QUEUED" : "LOGGED" } });
  if (!process.env.RESEND_API_KEY) return;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: process.env.EMAIL_FROM, to, subject, text: body }),
    });
    await db.emailOutbox.update({
      where: { id: row.id },
      data: res.ok ? { status: "SENT", sentAt: new Date() } : { status: "FAILED", error: `HTTP ${res.status}` },
    });
  } catch (e) {
    await db.emailOutbox.update({ where: { id: row.id }, data: { status: "FAILED", error: String(e).slice(0, 300) } });
  }
}
