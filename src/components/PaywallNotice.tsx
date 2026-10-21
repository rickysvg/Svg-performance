import Link from "next/link";
import { MEMBER_PRO_DAYS } from "@/lib/pricing";

export function PaywallNotice({ feature }: { feature: string }) {
  return (
    <section className="rounded-2xl border border-accent/40 bg-card p-5">
      <p className="text-xs font-bold uppercase tracking-wide text-accent">
        SVG Pro
      </p>
      <h1 className="mt-2 text-2xl">{feature}</h1>
      <p className="mt-2 text-sm text-muted">
        This opens on Pro ($9.99/mo or $72.99/yr). Verified SVG Academy members get the core
        app with their dues and Pro free for {MEMBER_PRO_DAYS} days. Checkout is coming soon.
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
