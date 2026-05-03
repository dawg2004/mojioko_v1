import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#162019",
        leaf: "#2f6b4f",
        mist: "#edf5f1",
        linen: "#fbfaf7",
        coral: "#d97059",
      },
      boxShadow: {
        soft: "0 18px 45px rgba(22, 32, 25, 0.08)",
      },
    },
  },
  plugins: [],
};

export default config;
