const defaultTheme = require("tailwindcss/defaultTheme");

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        canvas: "#26281f",
        accent: "#8b5cf6",
        accentSoft: "#b99cff",
        panel: "#3f4037",
        ink: "#f4f0e8"
      },
      fontFamily: {
        sans: [
          "\"Pretendard Variable\"",
          "\"Apple SD Gothic Neo\"",
          "\"Malgun Gothic\"",
          "\"Noto Sans KR\"",
          ...defaultTheme.fontFamily.sans
        ]
      },
      boxShadow: {
        glow: "0 24px 80px rgba(139, 92, 246, 0.18)",
        card: "0 25px 60px rgba(12, 14, 10, 0.28)"
      },
      backgroundImage: {
        noise:
          "radial-gradient(circle at 20% 20%, rgba(255,255,255,0.05) 0, transparent 28%), radial-gradient(circle at 80% 30%, rgba(139,92,246,0.10) 0, transparent 24%), radial-gradient(circle at 50% 80%, rgba(252,211,77,0.08) 0, transparent 22%)"
      }
    }
  },
  plugins: []
};
