import Link from "next/link";
import { CheckoutButton } from "@/components/billing/CheckoutButton";
import { proAccessSummary } from "@/lib/pricing";

export function PaywallNotice({ feature }: { feature: string }) {
  return (
    <section className="rounded-2xl border border-accent/40 bg-card p-5">
      <p className="text-xs font-bold uppercase tracking-wide text-accent">
        SVG Pro
      </p>
      <h1 className="mt-2 text-2xl">{feature}</h1>
      <p className="mt-2 text-sm text-muted">
        This opens on Pro ($9.99/mo or $72.99/yr). {proAccessSummary()} Subscribing during your trial keeps the remaining days when more than 48 hours remain.
      </p>
      <div className="mt-4 space-y-3">
        <CheckoutButton plan="performance_monthly" label="Subscribe · $9.99/mo" />
        <CheckoutButton plan="performance_year" label="Subscribe · $72.99/yr" />
        <Link href="/pricing" className="inline-flex text-sm text-accent underline">
          Compare plans
        </Link>
      </div>
    </section>
  );
}
