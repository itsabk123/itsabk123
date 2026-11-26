import type { Config } from "tailwindcss";
export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: "#0F1B2D", soft: "#22324A" },
        paper: { DEFAULT: "#FAF8F4", deep: "#F2EEE6" },
        charcoal: "#2B2F36",
        muted: "#6B6F76",
        line: "#E6E1D8",
        gold: { DEFAULT: "#A8844E", soft: "#F3ECDF" },
        accent: { DEFAULT: "#2F55D4", soft: "#E9EEFC" },
        ok: "#2F7A4F",
        warn: "#A86B12",
        bad: "#B4372F",
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "Noto Sans Arabic", "sans-serif"],
        serif: ["Iowan Old Style", "Charter", "Georgia", "Noto Naskh Arabic", "serif"],
      },
      maxWidth: { page: "72rem" },
    },
  },
  plugins: [],
} satisfies Config;
