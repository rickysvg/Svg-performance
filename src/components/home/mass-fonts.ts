import { Orbitron } from "next/font/google";
import { parseMassFont, type MassFontId } from "@/lib/mass-caption";

const orbitron = Orbitron({
  weight: "600",
  subsets: ["latin"],
  display: "swap",
  preload: false,
});

/** Variant 2 only. Variant 1 is drawn as segmented digits, not a webfont. */
export function massFontClass(id: MassFontId) {
  if (id === 2) return `${orbitron.className} mass-speedo`;
  return "";
}

export function massFontFromParam(raw: string | string[] | undefined) {
  const id = parseMassFont(raw);
  return { id, className: massFontClass(id) };
}
