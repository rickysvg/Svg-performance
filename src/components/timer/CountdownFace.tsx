import type { CountdownDigit } from "@/lib/round-countdown";

export function CountdownFace({ digit }: { digit: CountdownDigit }) {
  return (
    <div data-countdown={digit} className="text-center">
      <p className="font-display text-xs uppercase tracking-[0.16em] text-[#CBF805]">Get ready</p>
      <p className="stat-display mt-2 text-[6.25rem] leading-none text-[#CBF805]">{digit}</p>
    </div>
  );
}
