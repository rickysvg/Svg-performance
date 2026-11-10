import Link from "next/link";
import { nonmemberTrialReminderStage } from "@/lib/checkout-trial";

export function NonmemberTrialReminderBanner({ daysLeft }: { daysLeft: number }) {
  const stage = nonmemberTrialReminderStage(daysLeft);
  if (!stage) return null;
  const title = stage === "2d" ? "2 days left on your Pro trial" : "1 day left on your Pro trial";
  return (
    <section data-nonmember-trial-reminder={stage} className="mb-4 rounded-2xl border border-black bg-accent/20 p-4">
      <p className="font-display text-xs uppercase tracking-[0.06em] text-black">SVG Pro</p>
      <h2 className="mt-1 text-lg text-black">{title}</h2>
      <p className="mt-1 text-sm text-black">
        No card is on file. When the trial ends, history stays visible and training, logging, timers, the coach, and downloads lock until you subscribe. Pro is $9.99/mo or $72.99/yr.
      </p>
      <Link
        href="/pricing"
        className="touch-target mt-3 inline-flex w-full items-center justify-center rounded-full bg-accent text-black"
      >
        See Pro
      </Link>
    </section>
  );
}
