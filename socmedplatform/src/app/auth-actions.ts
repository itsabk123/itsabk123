"use server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { clientIp, createSession, hashPassword, passwordProblem, verifyPassword, getCurrentUser, requireUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { randomToken, sha256 } from "@/lib/crypto";
import { queueEmail } from "@/lib/notify";
import { audit, track } from "@/lib/audit";
import { str } from "@/lib/forms";

const safeNext = (n: string) => (n.startsWith("/") && !n.startsWith("//") ? n : "");
const back = (path: string, params: Record<string, string>) => `${path}?${new URLSearchParams(params)}`;

async function sendVerification(userId: string, email: string) {
  const token = randomToken();
  await db.authToken.create({ data: { userId, type: "VERIFY_EMAIL", tokenHash: sha256(token), expiresAt: new Date(Date.now() + 3 * 86400_000) } });
  await queueEmail(email, "Confirm your email", `Confirm your email address to unlock proposals and payments:\n${process.env.APP_URL ?? ""}/verify-email?token=${token}`);
}

export async function signup(fd: FormData) {
  const name = str(fd, "name", 120);
  const email = str(fd, "email", 200).toLowerCase();
  const password = String(fd.get("password") ?? "");
  const role = str(fd, "role", 20);
  const next = safeNext(str(fd, "next", 300));
  const ref = str(fd, "ref", 40);
  const keep = { name, email, role, next, ref };
  if (!(await rateLimit(`signup:${await clientIp()}`, 10, 3600))) redirect(back("/signup", { ...keep, err: "Too many sign-ups from this network. Try again later." }));
  if (!name || !/^\S+@\S+\.\S+$/.test(email)) redirect(back("/signup", { ...keep, err: "Enter your name and a valid email." }));
  const pwErr = passwordProblem(password);
  if (pwErr) redirect(back("/signup", { ...keep, err: pwErr }));
  if (str(fd, "terms") !== "on") redirect(back("/signup", { ...keep, err: "Please accept the terms to continue." }));
  if (await db.user.findUnique({ where: { email } })) redirect(back("/login", { email, err: "An account with that email exists. Log in instead." }));
  const referrer = ref ? await db.user.findUnique({ where: { referralCode: ref } }) : null;
  const user = await db.user.create({
    data: {
      name, email, passwordHash: await hashPassword(password), referralCode: randomToken(6).replace(/[-_]/g, "x"),
      referredById: referrer?.id, marketingOptIn: str(fd, "marketing") === "on",
    },
  });
  if (referrer) await db.referral.create({ data: { referrerUserId: referrer.id, refereeUserId: user.id } });
  await sendVerification(user.id, email);
  await createSession(user.id);
  await track("signup", user.id, { role, referred: !!referrer });
  redirect(next || `/app/onboarding${role ? `?role=${role}` : ""}`);
}

export async function login(fd: FormData) {
  const email = str(fd, "email", 200).toLowerCase();
  const password = String(fd.get("password") ?? "");
  const next = safeNext(str(fd, "next", 300));
  const ip = await clientIp();
  if (!(await rateLimit(`login:${ip}`, 20, 900)) || !(await rateLimit(`login:${email}`, 8, 900)))
    redirect(back("/login", { email, next, err: "Too many attempts. Wait 15 minutes and try again." }));
  const user = await db.user.findUnique({ where: { email } });
  // Same message and similar timing whether or not the account exists.
  const ok = user ? await verifyPassword(password, user.passwordHash) : await verifyPassword(password, "$2a$12$fRQg4X/FB3keg5LfYGZPmuEwQ52/sPJZrWmaOpTg3aQoOGtfiBlx2");
  if (!user || !ok) redirect(back("/login", { email, next, err: "Email or password is incorrect." }));
  if (user.status !== "ACTIVE") redirect(back("/login", { email, err: "This account is suspended. Contact support to appeal." }));
  await createSession(user.id);
  await audit(user.id, "auth.login", { type: "User", id: user.id }, { ip });
  redirect(next || "/app");
}

export async function requestReset(fd: FormData) {
  const email = str(fd, "email", 200).toLowerCase();
  if (await rateLimit(`reset:${email}`, 3, 3600)) {
    const user = await db.user.findUnique({ where: { email } });
    if (user) {
      const token = randomToken();
      await db.authToken.create({ data: { userId: user.id, type: "RESET_PASSWORD", tokenHash: sha256(token), expiresAt: new Date(Date.now() + 3600_000) } });
      await queueEmail(email, "Reset your password", `Reset your password (valid for 1 hour):\n${process.env.APP_URL ?? ""}/reset-password?token=${token}\n\nIf you didn't request this, ignore this email.`);
    }
  }
  redirect("/forgot-password?ok=If+an+account+exists%2C+we%27ve+sent+a+reset+link.");
}

export async function resetPassword(fd: FormData) {
  const token = str(fd, "token", 200);
  const password = String(fd.get("password") ?? "");
  const pwErr = passwordProblem(password);
  if (pwErr) redirect(back("/reset-password", { token, err: pwErr }));
  const t = await db.authToken.findUnique({ where: { tokenHash: sha256(token) } });
  if (!t || t.type !== "RESET_PASSWORD" || t.usedAt || t.expiresAt < new Date() || !t.userId) redirect("/forgot-password?err=That+link+has+expired.+Request+a+new+one.");
  await db.$transaction([
    db.user.update({ where: { id: t.userId }, data: { passwordHash: await hashPassword(password) } }),
    db.authToken.update({ where: { id: t.id }, data: { usedAt: new Date() } }),
    db.session.deleteMany({ where: { userId: t.userId } }), // sign out everywhere
  ]);
  await audit(t.userId, "auth.password_reset", { type: "User", id: t.userId });
  redirect("/login?ok=Password+updated.+Please+log+in.");
}

export async function resendVerification() {
  const user = await requireUser();
  if (user.emailVerifiedAt) redirect("/app");
  if (await rateLimit(`verify:${user.id}`, 3, 3600)) await sendVerification(user.id, user.email);
  redirect("/app?ok=Verification+email+sent.");
}

export async function verifyEmailToken(token: string) {
  const t = await db.authToken.findUnique({ where: { tokenHash: sha256(token) } });
  if (!t || t.type !== "VERIFY_EMAIL" || t.usedAt || t.expiresAt < new Date() || !t.userId) return false;
  await db.$transaction([
    db.user.update({ where: { id: t.userId }, data: { emailVerifiedAt: new Date() } }),
    db.authToken.update({ where: { id: t.id }, data: { usedAt: new Date() } }),
  ]);
  return true;
}

export async function currentUserOrNull() {
  return getCurrentUser();
}
