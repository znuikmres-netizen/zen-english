import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: "#0f172a",   // slate-950
          card:    "#1e293b",   // slate-800
          border:  "#334155",   // slate-700
        },
        up:   "#ef4444",  // Taiwan: red = up
        down: "#22c55e",  // Taiwan: green = down
        neutral: "#94a3b8",
      },
    },
  },
  plugins: [],
};

export default config;
