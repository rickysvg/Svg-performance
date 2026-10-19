import Link from "next/link";

export function PaywallNotice({ feature }: { feature: string }) {
  return (
    <section className="rounded-2xl border border-accent/40 bg-card p-5">
      <p className="text-xs font-bold uppercase tracking-wide text-accent">
        TEST subscription required
      </p>
      <h1 className="mt-2 text-2xl">{feature}</h1>
      <p className="mt-2 text-sm text-muted">
        This opens on SVG Performance ($9.99/mo or $79/yr) or with a verified SVG Academy
        membership. The free plan keeps the workout log, timers, and 1 sample plan. Paid
        plans coming soon.
      </p>
      <Link
        href="/pricing"
        className="touch-target mt-4 inline-flex items-center rounded-full bg-accent px-5 text-black"
      >
        See pricing
      </Link>
    </section>
  );
}
