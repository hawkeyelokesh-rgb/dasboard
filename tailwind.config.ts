import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: { 50: "#F5F5F4", 100: "#E7E6E3", 400: "#6B6A66", 700: "#2A2824", 900: "#14130F" },
        gold: { 50: "#FBF7EE", 100: "#F3E7C9", 300: "#DCB969", 500: "#B8912F", 600: "#9C7824", 700: "#7A5E1C" },
      },
    },
  },
  plugins: [],
};
export default config;
