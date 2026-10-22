import { Geist_Mono } from "next/font/google";

/** Monospace for telemetry readouts. Kept out of the root layout source. */
export const telemetryFont = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});
