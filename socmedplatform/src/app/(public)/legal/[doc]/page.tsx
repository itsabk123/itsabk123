import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Markdown } from "@/components/markdown";
import { SITE } from "@/lib/site";

const DOCS: Record<string, { title: string; body: string }> = {
  terms: {
    title: "Terms and Conditions",
    body: `## 1. Who we are
${SITE.name} operates an online marketplace that lets brands, agencies, podcast hosts, podcast guests and creators discover each other and arrange collaborations. We are not a party to the collaborations arranged between users, except as stated for payments.

## 2. Accounts
You must be at least 18 and able to enter contracts. One account may hold several profiles (brand, podcast, guest, creator, agency). You are responsible for activity under your account and for keeping your password secure. Organization owners are responsible for the members they invite.

## 3. Your content and data
You keep ownership of what you upload. You grant us a licence to host and display it to operate the service. You must not upload content you don't have rights to, and audience figures you enter must be honest. Self-reported metrics are labelled as such.

## 4. Collaborations
Proposals, counter-offers and accepted terms are recorded on the platform. The generated collaboration agreement is a template between the two parties. It is not legal advice; seek your own advice where needed.

## 5. Payments and fees
Payments are processed by a third-party payment provider. We act as a limited collection agent: we collect the payer's funds and release them to the payee after delivery is approved, less our platform fee and applicable VAT. Funds are not held in a regulated escrow account. A payment is treated as received only when our provider confirms it.

## 6. Advertising compliance
Each user is responsible for complying with UAE law that applies to them, including advertising disclosure rules, any UAE Media Council permit or licensing requirements, and sector rules (for example health, financial services and real estate). Platform membership does not constitute a permit or licence.

## 7. Prohibited conduct
No fake engagement, impersonation, spam, harassment, circumventing fees on deals originated on the platform during an active engagement, or unlawful or prohibited advertising categories.

## 8. Suspension
We may suspend accounts for breaches after review. You can appeal by contacting us.

## 9. Liability
To the extent permitted by law, we are not liable for the performance of collaborations between users, or for indirect losses.

## 10. Governing law
These terms are governed by the laws of the United Arab Emirates as applied in the Emirate of Dubai.`,
  },
  privacy: {
    title: "Privacy Policy",
    body: `This policy explains how we process personal data, with reference to the UAE Personal Data Protection Law (Federal Decree-Law No. 45 of 2021) and, where applicable, other laws.

## What we collect
- Account data: name, email, password hash, optional phone number.
- Profile data you choose to publish: bio, location, languages, links, audience figures and demographics (aggregate, not your followers' identities).
- Usage data: pages visited and actions taken, to run and improve the service.
- Transaction data: proposals, contracts, payment status and invoices. Card details are handled by our payment provider and never stored by us.
- Verification documents you upload, stored privately and visible only to authorised reviewers.

## What we don't do
We don't sell personal data. Aggregate market insights we publish are anonymised and never identify individuals or confidential deal terms. Our matching does not use gender, nationality, religion or other sensitive attributes.

## Legal bases
Contract (to provide the service), legitimate interests (security, fraud prevention, product improvement), consent (marketing emails, optional data), and legal obligation (tax records).

## Sharing
With the other party to a collaboration (only what's needed), service providers (hosting, payments, email) under contract, and authorities where legally required.

## Retention
Account data is kept while your account is active. Invoices and payment records are retained for the period required by UAE tax law. Verification documents are deleted after review or expiry plus a short audit period.

## Your rights
Access, correction, deletion, restriction, objection and portability, subject to the law. Use Settings to export or delete your data, or contact us.

## Security
Encryption in transit, hashed passwords, access controls, audit logs and signed, expiring links for private files.`,
  },
  cookies: {
    title: "Cookie Policy",
    body: `We use only the cookies needed to run the service:

- **mj_session** — keeps you signed in (essential, httpOnly).
- **mj_profile** — remembers which of your profiles you're acting as (essential).
- **mj_locale** — remembers your language (functional).

We do not use third-party advertising cookies. If we add analytics that require consent, we will ask first and update this page.`,
  },
  guidelines: {
    title: "Advertising & Creator Guidelines",
    body: `## Disclose every paid collaboration
Label sponsored content clearly and early (for example "Ad", "Paid partnership" or "إعلان"), in the same language as the content where practical. Gifted products and affiliate links count too.

## Permits and licences
Check whether you need a UAE Media Council advertiser permit or other licence for your activity, and keep it current. Store permit details on your profile so brands can see them. Platform membership is not a permit.

## Regulated categories
Healthcare, medicines and supplements, financial services and investments, real estate, education, alcohol and products for children may need prior approvals or carry extra rules. Campaigns in these categories are reviewed by our team. Tobacco and gambling are not accepted by default.

## Honest metrics
Never buy followers or engagement. Report figures you can evidence. Brands may ask for screenshots or a connected account.

## Respect
Respect UAE laws and cultural norms, privacy and intellectual property. Don't post content about people without consent.

## Brands
Brief creators clearly, don't ask them to make claims you can't substantiate, and approve or give feedback within agreed timelines.`,
  },
  disputes: {
    title: "Dispute & Refund Policy",
    body: `## Before work starts
If a funded deal is cancelled before work starts, the payer receives a full refund of the amount charged.

## Opening a dispute
Either party can open a dispute from the deal page while a deal is funded, in progress or delivered. Opening a dispute immediately pauses any payout for that deal.

## Review
Our team reviews the agreement, messages, submissions and evidence from both sides, usually within 5 business days. We may ask for more information.

## Outcomes
- **Release** — the payout is released to the creator.
- **Refund** — the payer is refunded (full or partial).
- **Split** — a partial refund and partial release.

Refunds are returned to the original payment method via our payment provider. Our platform fee is refunded proportionally to any refund.

## Not covered
Disagreements about performance that wasn't guaranteed in the agreement (for example sales results) are not grounds for refund, unless the agreed deliverables weren't provided.

## Appeals
You can appeal a decision once, within 14 days, with new information.`,
  },
};

export async function generateMetadata({ params }: { params: Promise<{ doc: string }> }): Promise<Metadata> {
  const d = DOCS[(await params).doc];
  return d ? { title: d.title } : {};
}

export default async function Legal({ params }: { params: Promise<{ doc: string }> }) {
  const d = DOCS[(await params).doc];
  if (!d) notFound();
  return (
    <div className="page max-w-3xl py-14">
      <h1 className="h1 !text-4xl">{d.title}</h1>
      <div className="mt-4 rounded-xl border border-warn/30 bg-[#FBF1E2] px-4 py-3 text-sm text-warn">
        Draft for pre-launch review. This document must be reviewed and approved by qualified UAE legal counsel before the platform accepts live users or payments.
      </div>
      <div className="mt-10"><Markdown text={d.body} /></div>
    </div>
  );
}
