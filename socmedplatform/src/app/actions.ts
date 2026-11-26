"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { destroySession, requireUser } from "@/lib/auth";
import { canActFor } from "@/lib/access";

export async function setLocale(fd: FormData) {
  const loc = fd.get("locale") === "ar" ? "ar" : "en";
  (await cookies()).set("mj_locale", loc, { path: "/", maxAge: 365 * 86400, sameSite: "lax" });
  const back = String(fd.get("back") ?? "/");
  redirect(back.startsWith("/") && !back.startsWith("//") ? back : "/");
}

export async function logout() {
  await destroySession();
  redirect("/");
}

export async function switchProfile(fd: FormData) {
  const user = await requireUser();
  const id = String(fd.get("profileId") ?? "");
  if (await canActFor(user.id, id)) {
    (await cookies()).set("mj_profile", id, { path: "/", httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" });
  }
  redirect("/app");
}
