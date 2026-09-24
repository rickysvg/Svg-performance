import { COACH_CREDIT_DISCLAIMER, creditForExercise } from "@/lib/coach-credits";

export function CoachCredit({ name }: { name: string }) {
  const credit = creditForExercise(name);
  if (!credit) return null;
  return (
    <p data-coach-credit={name} className="mt-1 text-[11px] leading-snug text-muted">
      <a
        href={credit.url}
        target="_blank"
        rel="noreferrer"
        className="font-medium text-foreground underline-offset-2 hover:underline"
      >
        {credit.line}
      </a>
      {credit.svgScaling ? <span> · SVG scaling</span> : null}
      <span className="mt-0.5 block text-[10px] text-muted">{COACH_CREDIT_DISCLAIMER}</span>
    </p>
  );
}
