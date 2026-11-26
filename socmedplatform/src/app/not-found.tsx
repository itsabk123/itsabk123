import Link from "next/link";
export default function NotFound() {
  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center">
      <div className="eyebrow">404</div>
      <h1 className="h2 mt-2">We couldn't find that page</h1>
      <p className="mt-2 text-muted">It may have been unpublished or moved.</p>
      <div className="mt-6 flex justify-center gap-2"><Link href="/" className="btn-primary">Home</Link><Link href="/discover/podcasts" className="btn-secondary">Discover</Link></div>
    </div>
  );
}
