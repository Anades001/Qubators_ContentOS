import type { Config } from "tailwindcss";

// Tokens mirror design.html — the visual contract for the MVP.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#1E1B1E",
        cream: "#FAF7F2",
        card: "#FFFFFF",
        rose: { DEFAULT: "#E8B4B8", dark: "#C98A8E" },
        gold: "#C9A96A",
        plum: { DEFAULT: "#5B21B6", soft: "#EDE9FE" },
        stone: "#8A8580",
        line: "#EEE5DA",
        danger: "#B42318",
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      borderRadius: { card: "14px" },
      boxShadow: { card: "0 8px 24px rgba(30,27,30,.06)" },
    },
  },
  plugins: [],
};

export default config;
