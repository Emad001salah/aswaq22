/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}"
  ],
  darkMode: "media",
  theme: {
    extend: {
      colors: {
        primary: "#aa3bff",
        secondary: "#6b6375",
        accent: "#c084fc",
        background: "var(--bg)"
      },
      fontFamily: {
        sans: ["var(--sans)", "system-ui", "sans-serif"],
        heading: ["var(--heading)", "system-ui", "sans-serif"]
      }
    }
  },
  plugins: []
};
