/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"DM Sans"', "system-ui", "sans-serif"],
      },
      colors: {
        cabin: {
          bg: "#020617",
          panel: "#020617",
          panelSoft: "#020617",
          accent: "#f97316",
          accentSoft: "#451a03",
        },
      },
      boxShadow: {
        cabin: "0 24px 60px rgba(15,23,42,0.9)",
      },
    },
  },
  plugins: [],
};

