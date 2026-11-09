/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          bg: "#0f172a",
          card: "#1e293b",
          border: "#334155",
          primary: "#38bdf8",
          primaryDark: "#0284c7",
          success: "#10b981",
          warning: "#f59e0b",
          danger: "#f43f5e",
        },
        gold: {
          100: "#fffbeb",
          200: "#fef3c7",
          300: "#fde68a",
          400: "#fbbf24",
          500: "#ffb800",
          600: "#e6a600",
          700: "#b45309",
          800: "#92400e",
          900: "#78350f",
        },
        dark: {
          600: "#333333",
          700: "#212121",
          800: "#16181f",
          900: "#0b0c10",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["var(--font-fira-code)", "monospace"],
      },
    },
  },
  plugins: [],
};
