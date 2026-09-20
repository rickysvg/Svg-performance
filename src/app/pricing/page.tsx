import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { getCurrentUser } from "@/lib/session";

export default async function PricingPage() {
  const user = await getCurrentUser();
  return (
    <div className="min-h-full">
      <AppHeader email={user?.email} />
      <main className="mx-auto max-w-3xl px-4 py-10">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent">
          Proposal only — not live
        </p>
        <h1 className="mt-2 text-3xl font-semibold">Draft subscription prices</h1>
        <p className="mt-3 text-muted">
          These numbers are a planning proposal. There is no Stripe checkout
          and no card will be charged from this app.
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <article className="rounded-2xl border border-line bg-card p-6">
            <h2 className="text-lg font-semibold">Verified gym member</h2>
            <p className="mt-2 text-3xl font-semibold text-accent">$19<span className="text-base text-muted">/mo</span></p>
            <p className="mt-3 text-sm text-muted">
              Only after an admin manually verifies SVG MMA Academy membership.
              Checking a box yourself does not unlock this price.
            </p>
          </article>
          <article className="rounded-2xl border border-line bg-card p-6">
            <h2 className="text-lg font-semibold">Standalone subscriber</h2>
            <p className="mt-2 text-3xl font-semibold">$29<span className="text-base text-muted">/mo</span></p>
            <p className="mt-3 text-sm text-muted">
              Proposed price for people who are not verified gym members.
              Billing is not turned on in Milestone 1.
            </p>
          </article>
        </div>
        <p className="mt-6 text-sm text-muted">
          Gym membership verification is separate from payment. That rule is
          enforced in the profile: the verified flag cannot be set by the member.
        </p>
        <Link href="/" className="mt-8 inline-flex text-accent underline-offset-4 hover:underline">
          Back to home
        </Link>
      </main>
    </div>
  );
}
