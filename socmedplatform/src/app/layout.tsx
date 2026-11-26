import type { Metadata, Viewport } from "next";
import "./globals.css";
import { t } from "@/lib/i18n";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: { default: `${SITE.name} — UAE creator, podcast & brand collaborations`, template: `%s · ${SITE.name}` },
  description: SITE.description,
  openGraph: { type: "website", siteName: SITE.name, locale: "en_AE" },
  twitter: { card: "summary_large_image" },
  alternates: { canonical: "/" },
};
export const viewport: Viewport = { themeColor: "#FAF8F4", width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { locale, dir } = await t();
  return (
    <html lang={locale} dir={dir}>
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
