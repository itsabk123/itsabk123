import Link from "next/link";
export const metadata = { title: "About", description: "Why we're building a UAE-first marketplace for creators, podcasts and brands." };
export default function About() {
  return (
    <div className="page max-w-3xl py-14">
      <div className="eyebrow mb-3">About</div>
      <h1 className="h1 !text-4xl">Building valuable, repeatable commercial relationships.</h1>
      <div className="mt-8 space-y-4 text-charcoal">
        <p>The UAE's podcast, creator and branded-content markets are fragmented across DMs, spreadsheets, agencies and WhatsApp threads. Brands struggle to judge fit; creators struggle to get paid on time; experts struggle to find the right shows.</p>
        <p>We're building one place where every side can discover each other, judge fit with honest data, agree terms, pay and measure results — with UAE specifics built in: seven emirates, multilingual audiences, AED pricing, VAT-aware invoicing and advertising compliance.</p>
        <p>We measure ourselves on successful collaborations and repeat partnerships — not sign-ups.</p>
        <h2 className="h2 pt-6">Principles</h2>
        <ul className="list-disc space-y-2 ps-5">
          <li>No fake metrics, testimonials or logos. Every figure shows its source.</li>
          <li>Recommendations are explainable and never use sensitive personal attributes.</li>
          <li>Paid placement is always labelled.</li>
          <li>Money moves only when the payment provider confirms it.</li>
        </ul>
      </div>
      <Link href="/contact" className="btn-secondary mt-10">Get in touch</Link>
    </div>
  );
}
