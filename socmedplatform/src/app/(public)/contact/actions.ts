"use server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { str } from "@/lib/forms";
import { rateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/auth";

export async function submitContact(fd: FormData) {
  if (str(fd, "website")) redirect("/contact?ok=Thanks"); // honeypot
  const ip = await clientIp();
  if (!(await rateLimit(`contact:${ip}`, 5, 3600))) redirect("/contact?err=Too+many+messages.+Please+try+later.");
  const name = str(fd, "name", 120), email = str(fd, "email", 200), body = str(fd, "body", 4000), topic = str(fd, "topic", 40) || "general";
  if (!name || !/^\S+@\S+\.\S+$/.test(email) || body.length < 5) redirect("/contact?err=Please+complete+all+fields.");
  await db.contactMessage.create({ data: { name, email, body, topic } });
  redirect("/contact?ok=Thanks+%E2%80%94+we%27ll+be+in+touch.");
}
