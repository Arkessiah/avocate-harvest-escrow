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
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
