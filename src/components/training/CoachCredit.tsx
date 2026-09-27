import { COACH_CREDIT_DISCLAIMER, creditForExercise } from "@/lib/coach-credits";

export function CoachCredit({ name }: { name: string }) {
  const credit = creditForExercise(name);
  if (!credit?.url) return null;
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
      {credit.svgScaling ? <span> · SVG set counts adjusted for your level</span> : null}
    </p>
  );
}

export function ProgramCredit({ names }: { names: string[] }) {
  const lines = [
    ...new Set(names.map((name) => creditForExercise(name)?.line).filter((line): line is string => Boolean(line))),
  ];
  if (lines.length === 0) return null;
  return (
    <p data-program-credit className="text-sm text-muted">
      {lines.join(" · ")}. {COACH_CREDIT_DISCLAIMER} Their own video is linked on the exercise.
    </p>
  );
}
