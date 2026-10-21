export function BagRoundSetup({
  workoutKey,
  rounds,
  workMinutes,
  restMinutes,
}: {
  workoutKey: string;
  rounds: number;
  workMinutes: number;
  restMinutes: number;
}) {
  return (
    <form action="/timer" className="space-y-3 rounded-2xl border border-line bg-card p-4" data-bag-round-setup>
      <input type="hidden" name="bagwork" value={workoutKey} />
      <p className="text-sm text-muted">
        Set the rounds yourself. The recommendation is a range, not a required count.
      </p>
      <div className="grid grid-cols-3 gap-2">
        <CountField label="Rounds" name="rounds" defaultValue={rounds} min={1} max={20} />
        <CountField label="Round min" name="workMin" defaultValue={workMinutes} min={1} max={15} />
        <CountField label="Rest min" name="restMin" defaultValue={restMinutes} min={1} max={10} />
      </div>
      <button
        type="submit"
        className="touch-target w-full rounded-full bg-accent font-display text-sm uppercase tracking-wide text-black"
      >
        Start timer
      </button>
    </form>
  );
}

function CountField({
  label,
  name,
  defaultValue,
  min,
  max,
}: {
  label: string;
  name: string;
  defaultValue: number;
  min: number;
  max: number;
}) {
  return (
    <label className="block text-center text-xs uppercase tracking-wide text-muted">
      {label}
      <input
        name={name}
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        defaultValue={defaultValue}
        required
        className="mt-2 w-full rounded-2xl border border-line bg-background px-2 py-3 text-center text-lg text-foreground"
      />
    </label>
  );
}
