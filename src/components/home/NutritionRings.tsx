function clampPercent(value: number, target: number) {
  if (target <= 0) return 0;
  return Math.min(100, Math.max(0, (value / target) * 100));
}

function Ring({
  label,
  value,
  target,
  unit,
}: {
  label: string;
  value: number;
  target: number;
  unit: string;
}) {
  const pct = clampPercent(value, target);
  const radius = 28;
  const circ = 2 * Math.PI * radius;
  const dash = (pct / 100) * circ;
  const left = Math.max(0, target - value);

  return (
    <div className="flex flex-col items-center text-center">
      <svg viewBox="0 0 72 72" className="h-16 w-16" aria-hidden>
        <circle
          cx="36"
          cy="36"
          r={radius}
          fill="none"
          stroke="currentColor"
          className="text-line"
          strokeWidth="6"
        />
        <circle
          cx="36"
          cy="36"
          r={radius}
          fill="none"
          stroke="currentColor"
          className="text-accent"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`}
          transform="rotate(-90 36 36)"
        />
      </svg>
      <p className="mt-1 text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className="text-sm font-semibold">
        {Math.round(value)}
        <span className="font-normal text-muted">
          {" "}
          / {Math.round(target)} {unit}
        </span>
      </p>
      <p className="text-[11px] text-muted">{Math.round(left)} left</p>
    </div>
  );
}

export function NutritionRings({
  calories,
  proteinG,
  carbsG,
  fatG,
  targets,
}: {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  targets: { calories: number; proteinG: number; carbsG: number; fatG: number };
}) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      <Ring label="Calories" value={calories} target={targets.calories} unit="cal" />
      <Ring label="Protein" value={proteinG} target={targets.proteinG} unit="g" />
      <Ring label="Carbs" value={carbsG} target={targets.carbsG} unit="g" />
      <Ring label="Fat" value={fatG} target={targets.fatG} unit="g" />
    </div>
  );
}
