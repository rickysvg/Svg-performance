import { trialLabel } from "@/lib/trial";

export function TrialDaysLeft({ daysLeft }: { daysLeft: number }) {
  return (
    <p className="rounded-2xl border border-black bg-accent px-4 py-3 text-sm font-semibold text-black">
      {trialLabel(daysLeft)}
    </p>
  );
}
