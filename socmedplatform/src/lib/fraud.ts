/**
 * Heuristic quality signals. They create FLAGS for human review — they never accuse, hide or suspend anyone automatically.
 */
export type FraudSignal = { kind: string; details: string; score: number };

export function engagementSignals(accounts: { platform: string; followers: number | null; engagementRate: number | null; avgViews: number | null }[]): FraudSignal[] {
  const out: FraudSignal[] = [];
  for (const a of accounts) {
    if (a.followers && a.followers >= 10000 && a.engagementRate !== null && a.engagementRate > 25)
      out.push({ kind: "ENGAGEMENT_OUTLIER", details: `${a.platform}: ${a.engagementRate}% engagement at ${a.followers} followers is far above typical ranges`, score: 0.6 });
    if (a.followers && a.followers >= 50000 && a.engagementRate !== null && a.engagementRate < 0.2)
      out.push({ kind: "ENGAGEMENT_OUTLIER", details: `${a.platform}: ${a.engagementRate}% engagement at ${a.followers} followers may indicate inactive followers`, score: 0.4 });
    if (a.followers && a.avgViews && a.avgViews > a.followers * 20)
      out.push({ kind: "METRIC_JUMP", details: `${a.platform}: average views are ${Math.round(a.avgViews / a.followers)}× followers`, score: 0.3 });
  }
  return out;
}

/** Normalised text fingerprint for duplicate-bio detection. */
export function bioFingerprint(bio: string | null | undefined) {
  if (!bio || bio.length < 60) return null;
  return bio.toLowerCase().replace(/[^a-z0-9؀-ۿ]+/g, " ").trim().slice(0, 240);
}

/** Simple spam scoring for messages. */
export function spamScore(body: string, recentIdenticalCount: number) {
  let s = 0;
  const links = (body.match(/https?:\/\//g) ?? []).length;
  if (links >= 3) s += 0.4;
  if (/whatsapp\s*\+?\d|telegram|crypto|guaranteed (followers|returns)|wire transfer/i.test(body)) s += 0.3;
  if (recentIdenticalCount >= 3) s += 0.5;
  if (body.length > 20 && body === body.toUpperCase() && /[A-Z]/.test(body)) s += 0.2;
  return Math.min(1, s);
}
