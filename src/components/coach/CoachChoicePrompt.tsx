import Link from "next/link";
import { dismissCoachPromptAction } from "@/app/actions/coach-choice";

export function CoachChoicePrompt({
  coachName,
  styleLabel,
}: {
  coachName: string;
  styleLabel: string;
}) {
  return (
    <section data-coach-prompt className="rounded-2xl border border-line bg-card p-4">
      <p className="text-sm">
        <span className="font-semibold">{coachName}</span> is your SVG Coach for now, on a{" "}
        {styleLabel.toLowerCase()} style. Pick a face and a style whenever you want.
      </p>
      <div className="mt-3 flex gap-2">
        <Link
          href="/profile#coach"
          className="touch-target inline-flex flex-1 items-center justify-center rounded-full bg-accent text-sm text-black"
        >
          Choose
        </Link>
        <form action={dismissCoachPromptAction} className="flex-1">
          <button
            type="submit"
            className="touch-target w-full rounded-full border border-line text-sm font-semibold"
          >
            Keep {coachName}
          </button>
        </form>
      </div>
    </section>
  );
}
