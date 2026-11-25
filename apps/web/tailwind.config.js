/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        brand: {
          dark: "#070b14",
          surface: "#0d1322",
          card: "#121b2f",
          border: "#1e293b",
          cyan: "#00f0ff",
          blue: "#3b82f6",
        },
      },
    },
  },
  plugins: [],
}
