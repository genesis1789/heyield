import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#EEF4FF",
          100: "#E0EAFF",
          500: "#3D6FF6",
          600: "#0B5CFF",
          700: "#0A4BCC",
          DEFAULT: "#0B5CFF",
        },
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Inter", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(15, 23, 42, 0.04), 0 8px 24px -12px rgba(15, 23, 42, 0.12)",
      },
    },
  },
  plugins: [],
};

export default config;
