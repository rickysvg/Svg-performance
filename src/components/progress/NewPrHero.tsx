import type { DetectedPr } from "@/lib/personal-bests";

export function NewPrHero({
  pr,
  fallbackHeadline,
  fallbackDetail,
}: {
  pr?: DetectedPr | null;
  fallbackHeadline?: string | null;
  fallbackDetail?: string | null;
}) {
  const headline = pr?.headline ?? fallbackHeadline;
  const detail = pr?.detail ?? fallbackDetail;
  if (!headline) return null;
  return (
    <section className="overflow-hidden rounded-2xl bg-black px-4 py-6 text-center text-white">
      <p className="font-display text-xs uppercase tracking-[0.08em] text-[#CBF805]">New PR</p>
      <p className="font-display mt-2 text-5xl uppercase leading-none tracking-wide text-[#CBF805]">
        {headline}
      </p>
      {detail ? <p className="mt-3 text-sm text-white/80">{detail}</p> : null}
    </section>
  );
}
