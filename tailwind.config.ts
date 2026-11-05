import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: "#006CB7", 50: "#E5F1FB", 100: "#CFE4F6", 600: "#005FA3", 700: "#00508A" },
        navy: { DEFAULT: "#163B63", 800: "#0F2C4B" },
        prtred: "#E52329",
        prtgreen: "#69B345",
        softblue: "#E5F1FB",
        cloud: "#F5F8FC",
      },
      fontFamily: { sans: ["Inter", "Segoe UI", "system-ui", "sans-serif"] },
      boxShadow: {
        card: "0 1px 2px rgba(22,59,99,.06), 0 4px 16px rgba(22,59,99,.06)",
        pop: "0 12px 40px rgba(22,59,99,.18)",
      },
      keyframes: {
        floaty: { "0%,100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-6px)" } },
        slidein: { from: { opacity: "0", transform: "translateY(8px)" }, to: { opacity: "1", transform: "none" } },
      },
      animation: { floaty: "floaty 4s ease-in-out infinite", slidein: "slidein .25s ease-out" },
    },
  },
  plugins: [],
};
export default config;
