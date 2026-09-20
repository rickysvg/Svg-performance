import Link from "next/link";

export function PaywallNotice({ feature }: { feature: string }) {
  return (
    <section className="rounded-2xl border border-accent/40 bg-card p-5">
      <p className="text-xs font-bold uppercase tracking-wide text-accent">
        TEST subscription required
      </p>
      <h1 className="mt-2 text-2xl font-semibold">{feature}</h1>
      <p className="mt-2 text-sm text-muted">
        Stripe TEST keys are configured on this server, so access is granted
        only after a verified webhook — not after the browser redirect.
      </p>
      <Link
        href="/pricing"
        className="touch-target mt-4 inline-flex items-center rounded-full bg-accent px-5 font-semibold text-black"
      >
        View TEST plans
      </Link>
    </section>
  );
}
