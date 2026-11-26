import "server-only";
import { cookies } from "next/headers";

/** English-first; Arabic ships for navigation and core marketing copy with full RTL layout. Extend the dictionaries to add languages. */
export const LOCALES = { en: { dir: "ltr", label: "English" }, ar: { dir: "rtl", label: "العربية" } } as const;
export type Locale = keyof typeof LOCALES;

const dict = {
  en: {
    discover: "Discover", podcasts: "Podcasts", influencers: "Influencers", guests: "Guests", brands: "Brands", campaigns: "Campaigns",
    sponsorships: "Sponsorships", pricing: "Pricing", howItWorks: "How it works", login: "Log in", signup: "Join free", dashboard: "Dashboard",
    heroTitle: "Where brands meet creators, podcasts meet sponsors, and experts find their audience.",
    heroSub: "Discover the right podcasts, influencers, guests and brand partners across the UAE — then agree terms, get paid and measure results in one place.",
    findCreators: "Find creators", findSponsors: "Find podcast sponsors", beGuest: "Get featured as a guest", findPodcasts: "Find podcast opportunities",
    footerNote: "UAE-first marketplace for branded media collaborations.", language: "Language",
  },
  ar: {
    discover: "اكتشف", podcasts: "البودكاست", influencers: "المؤثرون", guests: "الضيوف", brands: "العلامات التجارية", campaigns: "الحملات",
    sponsorships: "الرعايات", pricing: "الأسعار", howItWorks: "كيف يعمل", login: "تسجيل الدخول", signup: "انضم مجاناً", dashboard: "لوحة التحكم",
    heroTitle: "حيث تلتقي العلامات التجارية بصنّاع المحتوى، والبودكاست بالرعاة، والخبراء بجمهورهم.",
    heroSub: "اكتشف البودكاست والمؤثرين والضيوف والشركاء المناسبين في الإمارات — ثم اتفق على الشروط واستلم المدفوعات وقِس النتائج في مكان واحد.",
    findCreators: "ابحث عن صنّاع المحتوى", findSponsors: "ابحث عن رعاة للبودكاست", beGuest: "كن ضيفاً", findPodcasts: "فرص البودكاست",
    footerNote: "منصة إماراتية للتعاون الإعلامي بين العلامات التجارية وصنّاع المحتوى.", language: "اللغة",
  },
} satisfies Record<Locale, Record<string, string>>;

export type Dict = (typeof dict)["en"];

export async function getLocale(): Promise<Locale> {
  const v = (await cookies()).get("mj_locale")?.value;
  return v === "ar" ? "ar" : "en";
}
export async function t(): Promise<{ locale: Locale; dir: "ltr" | "rtl"; d: Dict }> {
  const locale = await getLocale();
  return { locale, dir: LOCALES[locale].dir, d: dict[locale] };
}
