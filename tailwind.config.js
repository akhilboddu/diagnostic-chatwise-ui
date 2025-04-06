/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "white",
        foreground: "#1a1a1a",
        primary: "#3b82f6",
        "primary-foreground": "white",
        destructive: "#ef4444",
        "destructive-foreground": "white",
        muted: "#f3f4f6",
        "muted-foreground": "#6b7280",
      },
    },
  },
  plugins: [],
} 