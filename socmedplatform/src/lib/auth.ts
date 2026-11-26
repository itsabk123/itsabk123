import "server-only";
import bcrypt from "bcryptjs";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "./db";
import { randomToken, sha256 } from "./crypto";
import type { PlatformRole, User } from "@prisma/client";

const SESSION_COOKIE = "mj_session";
const SESSION_DAYS = 30;

export const hashPassword = (pw: string) => bcrypt.hash(pw, 12);
export const verifyPassword = (pw: string, hash: string) => bcrypt.compare(pw, hash);

export function passwordProblem(pw: string): string | null {
  if (pw.length < 10) return "Use at least 10 characters.";
  if (pw.length > 200) return "Password is too long.";
  if (!/[a-zA-Z]/.test(pw) || !/[0-9]/.test(pw)) return "Include both letters and numbers.";
  return null;
}

export async function clientIp() {
  const h = await headers();
  return (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || "unknown";
}

export async function createSession(userId: string) {
  const token = randomToken();
  const h = await headers();
  await db.session.create({
    data: {
      tokenHash: sha256(token),
      userId,
      expiresAt: new Date(Date.now() + SESSION_DAYS * 86400_000),
      ip: await clientIp(),
      userAgent: h.get("user-agent")?.slice(0, 300) ?? null,
    },
  });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 86400,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { tokenHash: sha256(token) } });
  jar.delete(SESSION_COOKIE);
  jar.delete("mj_profile");
}

export const getCurrentUser = cache(async (): Promise<User | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await db.session.findUnique({ where: { tokenHash: sha256(token) }, include: { user: true } });
  if (!session || session.expiresAt < new Date()) return null;
  if (session.user.status !== "ACTIVE") return null;
  // Touch activity at most every 10 minutes to keep writes cheap.
  if (Date.now() - session.user.lastActiveAt.getTime() > 600_000) {
    await db.user.update({ where: { id: session.userId }, data: { lastActiveAt: new Date() } });
  }
  return session.user;
});

export async function requireUser(next?: string): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect(`/login${next ? `?next=${encodeURIComponent(next)}` : ""}`);
  return user;
}

export function hasPlatformRole(user: Pick<User, "platformRole">, needed: PlatformRole | PlatformRole[]) {
  if (user.platformRole === "SUPERADMIN" || user.platformRole === "ADMIN") return true;
  const list = Array.isArray(needed) ? needed : [needed];
  return list.includes(user.platformRole);
}

export async function requireAdmin(roles: PlatformRole | PlatformRole[] = ["ADMIN"]): Promise<User> {
  const user = await requireUser("/admin");
  if (!hasPlatformRole(user, roles)) redirect("/app?err=Not+authorised");
  return user;
}
