import Link from "next/link";

/** Persistent upsell while Train, logging, timers, the coach, and downloads are locked. */
export function SubscribeToTrainBanner() {
  return (
    <section data-subscribe-to-train className="mb-4 rounded-2xl border border-black bg-accent/20 p-4">
      <h2 className="text-lg text-black">Subscribe to keep training</h2>
      <p className="mt-1 text-sm text-black">
        Workout history and progress stay visible. Training, logging, timers, the AI coach, and downloads stay off until you subscribe.
      </p>
      <Link
        href="/pricing"
        className="touch-target mt-3 inline-flex w-full items-center justify-center rounded-full bg-accent text-black"
      >
        Subscribe to keep training
      </Link>
    </section>
  );
}
