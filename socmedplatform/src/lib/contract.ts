import { sha256 } from "./crypto";
import { formatAed } from "./money";
import { formatDate } from "./time";

export const CONTRACT_TEMPLATE_VERSION = "uae-collab-v0.1-draft";

type Party = { name: string; slug: string };
export type ContractInput = {
  dealId: string;
  title: string;
  initiator: Party;
  recipient: Party;
  payer: Party | null;
  priceFils: number;
  deliverables: { title: string; dueDate?: string | null }[];
  publishDate: Date | null;
  usageRights: string | null;
  exclusivity: string | null;
  revisions: number;
  commissionPct: number;
};

/**
 * Generates a plain-language collaboration agreement from the accepted proposal.
 * IMPORTANT: this is a configurable template that must be reviewed by qualified UAE counsel before launch.
 * It is not legal advice, and the UI states this to both parties.
 */
export function renderContract(c: ContractInput) {
  const payee = c.payer ? (c.payer.slug === c.initiator.slug ? c.recipient : c.initiator) : null;
  const lines = [
    `COLLABORATION AGREEMENT — ${c.title}`,
    `Template ${CONTRACT_TEMPLATE_VERSION}. Reference ${c.dealId}.`,
    ``,
    `1. Parties. This agreement is between ${c.initiator.name} and ${c.recipient.name} (each a "Party"), arranged through the Majlis marketplace ("Platform"). The Platform is not a party to the creative work.`,
    `2. Deliverables. ${c.deliverables.length ? c.deliverables.map((d, i) => `(${i + 1}) ${d.title}${d.dueDate ? ` — due ${formatDate(new Date(d.dueDate))}` : ""}`).join("; ") : "As described in the agreed proposal."}`,
    `3. Publication. ${c.publishDate ? `Target publication date ${formatDate(c.publishDate)} (UAE time).` : "Publication timing as agreed in writing on the Platform."}`,
    c.priceFils > 0 && c.payer && payee
      ? `4. Fees and payment. ${c.payer.name} will pay ${formatAed(c.priceFils)} through the Platform before work starts. The Platform holds funds as a collection agent and releases them to ${payee.name} after the deliverables are approved, less the Platform fee of ${c.commissionPct}% (plus VAT where applicable). Funds are not held in a regulated escrow account.`
      : `4. Fees. No fee is payable between the Parties for this collaboration (e.g. a free expert appearance).`,
    `5. Approval and revisions. Content is submitted on the Platform for approval. Up to ${c.revisions} round(s) of reasonable revisions are included. Approval may not be unreasonably withheld; content not reviewed within 5 business days of submission may be treated as approved.`,
    `6. Usage rights and ownership. ${c.usageRights ?? "The creator retains ownership of the content. The brand may share the published content on its own channels with credit for 90 days. Paid usage (ads, whitelisting) requires separate written agreement."}`,
    `7. Exclusivity. ${c.exclusivity ?? "None, unless stated in the agreed proposal."}`,
    `8. Disclosure and compliance. All sponsored content must be clearly identified as advertising in line with applicable UAE requirements. Each Party is responsible for holding any licence or permit required of it (including any UAE Media Council advertiser permit where applicable). Use of the Platform does not grant any licence or permit.`,
    `9. Cancellation and refunds. Before work starts, either Party may cancel and any payment is refunded. After work starts, refunds follow the Platform's Dispute & Refund Policy and the outcome of any dispute.`,
    `10. Disputes. Parties will first raise disputes on the Platform, which pauses payout while under review. The Platform may mediate but does not issue binding judgments. Unresolved disputes are subject to the laws of the United Arab Emirates and the competent courts of Dubai, unless the Parties agree otherwise.`,
    `11. Confidentiality. Unpublished briefs, pricing and campaign data are confidential and may only be used to perform this agreement.`,
    `12. Performance reporting. The creator will share available performance data (with its source) within 14 days of publication. Figures are not guaranteed outcomes.`,
    ``,
    `Accepted electronically on the Platform by each Party. This template is provided for convenience and is not legal advice.`,
  ];
  const body = lines.join("\n");
  return { body, hash: sha256(body), version: CONTRACT_TEMPLATE_VERSION };
}
