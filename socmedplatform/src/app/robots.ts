import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/app", "/admin", "/api", "/pay", "/r/", "/login", "/signup", "/reset-password", "/verify-email"] }],
    sitemap: `${SITE.url}/sitemap.xml`,
  };
}
