import { Barlow_Condensed, Orbitron } from "next/font/google";
import { parseMassFont, type MassFontId } from "@/lib/mass-caption";

const orbitron = Orbitron({
  weight: "600",
  subsets: ["latin"],
  display: "swap",
  preload: false,
});

const condensedItalic = Barlow_Condensed({
  weight: "600",
  style: "italic",
  subsets: ["latin"],
  display: "swap",
  preload: false,
});

/** Class for the weight figure. 1 keeps the telemetry mono already on the card. */
export function massFontClass(id: MassFontId) {
  if (id === 2) return "mass-anton";
  if (id === 3) return `${orbitron.className} font-semibold`;
  if (id === 4) return `${condensedItalic.className} font-semibold italic`;
  return "font-telemetry";
}

export function massFontFromParam(raw: string | string[] | undefined) {
  const id = parseMassFont(raw);
  return { id, className: massFontClass(id) };
}
