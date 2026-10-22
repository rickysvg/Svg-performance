"use client";

const SCORES = [1, 2, 3, 4, 5] as const;

export function ScorePicker({
  name,
  label,
  hint,
  value,
  onChange,
}: {
  name: string;
  label: string;
  hint: string;
  value: number | null;
  onChange: (value: number) => void;
}) {
  return (
    <fieldset>
      <legend className="text-sm font-semibold">
        {label}
        <span className="mt-0.5 block text-xs font-normal text-muted">{hint}</span>
      </legend>
      <div className="mt-2 grid grid-cols-5 gap-2">
        {SCORES.map((score) => {
          const selected = value === score;
          return (
            <button
              data-testid={`checkin-score-${score}`}
              key={score}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(score)}
              className={`touch-target rounded-2xl border text-lg ${
                selected
                  ? "border-black bg-accent text-black"
                  : "border-line bg-white text-foreground"
              }`}
            >
              {score}
            </button>
          );
        })}
      </div>
      <input type="hidden" name={name} value={value ?? ""} />
    </fieldset>
  );
}
