import { Orbitron } from "next/font/google";

const orbitron = Orbitron({
  weight: "600",
  subsets: ["latin"],
  display: "swap",
  preload: false,
});

export const massSpeedoClass = `${orbitron.className} mass-speedo`;
/** Same face as the figure, without the speedo skew that would shove the unit into the arc. */
export const massUnitClass = orbitron.className;
