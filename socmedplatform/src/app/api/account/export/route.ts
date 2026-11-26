import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

/** Data portability: everything we hold that is linked to the signed-in user, excluding other people's private data. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Unauthorised", { status: 401 });
  const profiles = await db.profile.findMany({ where: { ownerUserId: user.id }, include: { brand: true, podcast: true, guest: true, influencer: true, agency: true, socialAccounts: true, metrics: true, audience: true, offerings: true, availability: true, reviewsReceived: true, reviewsWritten: true } });
  const ids = profiles.map((p) => p.id);
  const [deals, messages, notifications, saved, searches] = await Promise.all([
    db.deal.findMany({ where: { OR: [{ initiatorProfileId: { in: ids } }, { recipientProfileId: { in: ids } }] }, include: { proposals: true, contract: true, deliverables: true, payments: { select: { id: true, amountFils: true, status: true, createdAt: true } } } }),
    db.message.findMany({ where: { senderUserId: user.id } }),
    db.notification.findMany({ where: { userId: user.id } }),
    db.savedProfile.findMany({ where: { userId: user.id } }),
    db.savedSearch.findMany({ where: { userId: user.id } }),
  ]);
  const { passwordHash: _ph, ...account } = user;
  void _ph;
  const body = JSON.stringify({ exportedAt: new Date(), account, profiles, deals, messagesSent: messages, notifications, saved, searches }, null, 2);
  return new NextResponse(body, { headers: { "Content-Type": "application/json", "Content-Disposition": `attachment; filename="my-data.json"` } });
}
