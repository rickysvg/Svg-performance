import { setWeightAccessAction } from "@/app/actions/profile";
import { WEIGHT_ACCESS_OPTIONS, type WeightAccess } from "@/lib/weight-access";

export function WeightAccessToggle({
  access,
  nextPath,
}: {
  access: WeightAccess;
  nextPath: string;
}) {
  return (
    <section data-weight-access className="rounded-2xl border border-line bg-card px-4 py-3">
      <p className="font-display text-xs uppercase tracking-wide text-accent">Where you can train</p>
      <p className="mt-1 text-sm text-muted">
        Gym and weights is the plan. Choose no gym or weights for a full floor session you can do that day.
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {WEIGHT_ACCESS_OPTIONS.map((option) => {
          const active = option.value === access;
          return (
            <form key={option.value} action={setWeightAccessAction}>
              <input type="hidden" name="weightAccess" value={option.value} />
              <input type="hidden" name="next" value={nextPath} />
              <button
                type="submit"
                aria-pressed={active}
                className={`min-h-11 w-full rounded-full px-2 py-2 text-center text-sm font-semibold ${
                  active ? "bg-accent text-black" : "border border-line bg-white text-foreground"
                }`}
              >
                {option.label}
              </button>
            </form>
          );
        })}
      </div>
    </section>
  );
}
