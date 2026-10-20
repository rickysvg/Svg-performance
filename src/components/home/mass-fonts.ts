import { Orbitron } from "next/font/google";

const orbitron = Orbitron({
  weight: "600",
  subsets: ["latin"],
  display: "swap",
  preload: false,
});

export const massSpeedoClass = `${orbitron.className} mass-speedo`;
