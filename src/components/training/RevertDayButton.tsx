import { revertDayAction } from "@/app/actions/my-workouts";

export function RevertDayButton({ dayKey, next }: { dayKey: string; next: string }) {
  return (
    <form action={revertDayAction} data-revert-day={dayKey}>
      <input type="hidden" name="dayKey" value={dayKey} />
      <input type="hidden" name="next" value={next} />
      <button type="submit" className="text-sm font-semibold text-accent underline-offset-4 hover:underline">
        Revert to default
      </button>
    </form>
  );
}
