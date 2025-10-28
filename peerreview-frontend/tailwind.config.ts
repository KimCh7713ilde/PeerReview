import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: "#e6f0ff",
          100: "#b3d4ff",
          200: "#80b8ff",
          300: "#4d9cff",
          400: "#1a80ff",
          500: "#0066e6",
          600: "#0052b3",
          700: "#003d80",
          800: "#00294d",
          900: "#00141a",
        },
        accent: {
          light: "#ffd700",
          DEFAULT: "#ffb700",
          dark: "#ff9500",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        serif: ["Roboto Slab", "Georgia", "serif"],
      },
    },
  },
  plugins: [],
};
export default config;




