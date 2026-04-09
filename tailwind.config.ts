import type { Config } from "tailwindcss";

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        gemini: {
          bg: "#343541",           // Main chat background
          surface: "#202123",      // Sidebar background
          surface2: "#40414f",     // Input bar / inner background
          border: "rgba(255,255,255,0.15)", // Very subtle white borders
          accent: "#10a37f",       // OpenAI Green
          text: "#ececf1",         // Primary text
          muted: "#8e8ea0",        // Muted text
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      }
    },
  },
  plugins: [],
} satisfies Config;
