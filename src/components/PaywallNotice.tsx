import Link from "next/link";

export function PaywallNotice({ feature }: { feature: string }) {
  return (
    <section className="rounded-2xl border border-accent/40 bg-card p-5">
      <p className="text-xs font-bold uppercase tracking-wide text-accent">
        TEST subscription required
      </p>
      <h1 className="mt-2 text-2xl">{feature}</h1>
      <p className="mt-2 text-sm text-muted">
        Stripe TEST keys are configured on this server, so this tool needs a
        webhook-confirmed Performance+ plan — not just the browser redirect.
        Member Access still has basic training, progress, shop, and beginner Learn.
      </p>
      <Link
        href="/pricing"
        className="touch-target mt-4 inline-flex items-center rounded-full bg-accent px-5 text-black"
      >
        View TEST plans
      </Link>
    </section>
  );
}
