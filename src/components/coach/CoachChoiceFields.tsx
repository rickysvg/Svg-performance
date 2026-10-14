import { COACHES, COACHING_STYLES } from "@/lib/coaches";

export function CoachChoiceFields({
  coachId,
  styleId,
}: {
  coachId: string;
  styleId: string;
}) {
  return (
    <div className="space-y-6" data-coach-picker>
      <fieldset>
        <legend className="text-sm font-medium">Coach</legend>
        <div className="mt-3 grid grid-cols-2 gap-3">
          {COACHES.map((coach) => (
            <label
              key={coach.id}
              className="flex cursor-pointer flex-col rounded-2xl border border-line bg-background p-2 has-[:checked]:border-accent has-[:checked]:ring-2 has-[:checked]:ring-accent"
            >
              <input
                type="radio"
                name="aiCoachId"
                value={coach.id}
                defaultChecked={coach.id === coachId}
                required
                className="sr-only"
              />
              <img
                src={coach.src}
                alt=""
                width={512}
                height={512}
                className="aspect-square w-full rounded-xl object-cover"
              />
              <span className="mt-2 font-display text-sm uppercase tracking-wide">{coach.name}</span>
              <span className="text-xs leading-snug text-muted">{coach.vibe}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-sm font-medium">Coaching style</legend>
        <div className="mt-3 grid gap-2">
          {COACHING_STYLES.map((style) => (
            <label
              key={style.id}
              className="flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-background px-3 py-3 has-[:checked]:border-accent has-[:checked]:ring-2 has-[:checked]:ring-accent"
            >
              <input
                type="radio"
                name="coachingStyle"
                value={style.id}
                defaultChecked={style.id === styleId}
                required
                className="mt-0.5 h-5 w-5 accent-accent"
              />
              <span>
                <span className="block text-sm font-medium">{style.label}</span>
                <span className="block text-xs text-muted">{style.detail}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
    </div>
  );
}
