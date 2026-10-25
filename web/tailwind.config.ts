import type { Config } from "tailwindcss";

// Tokens are defined in DESIGN.md; keep both in sync.
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: "#009E63", dark: "#007A4D", deep: "#00653F", light: "#4FD1A5" },
        ink: "#0B1F17",
        mist: "#E8F5EF",
        // Tinted white for surfaces: pure white reads flat against the mint background.
        surface: "#F8FCFA",
        // The one highlighted card per screen: the figure or action the reader should watch.
        highlight: "#D4F1E4",
        // State and feedback colours, one name per role (values kept from the earlier
        // Tailwind palette so contrast stays as measured in DESIGN.md).
        pending: { DEFAULT: "#92400E", tint: "#FEF3C7" },
        released: { DEFAULT: "#065F46", tint: "#D1FAE5" },
        danger: { DEFAULT: "#BE123C", strong: "#9F1239", tint: "#FFE4E6", soft: "#FFF1F2", line: "#FECDD3" },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        condensed: ["var(--font-condensed)", "var(--font-sans)", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
