import Link from "next/link";
import { requireUser } from "@/lib/session";
import { usd } from "@/lib/pricing";
import { VIP_LABEL, VIP_MONTHLY_CENTS, VIP_REPLY_PROMISE } from "@/lib/vip-coaching";
import { getVipPricingPhase } from "@/lib/vip-store";
import { VipApplyForm } from "@/components/vip/VipApplyForm";
import { WaitlistButton } from "@/components/billing/WaitlistButton";

export default async function VipApplyPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const phase = await getVipPricingPhase(user.id);

  return (
    <main className="mx-auto max-w-lg space-y-5 pb-8" data-vip-apply="1">
      <p className="font-display text-xs uppercase tracking-[0.14em] text-[#CBF805]">{VIP_LABEL}</p>
      <h1 className="text-4xl">Apply</h1>
      <p className="text-sm text-muted">
        {usd(VIP_MONTHLY_CENTS / 100)}/mo. Limited spots. {VIP_REPLY_PROMISE}
      </p>
      {params.sent === "1" || phase === "pending" ? (
        <section className="rounded-2xl border border-[#CBF805]/40 bg-black px-4 py-4 text-white">
          <h2 className="text-2xl">Application in</h2>
          <p className="mt-2 text-sm text-white/80">
            Ricky reads every application. {VIP_REPLY_PROMISE} Checkout stays locked until he approves you.
          </p>
        </section>
      ) : phase === "checkout" ? (
        <section className="rounded-2xl border border-[#CBF805]/40 bg-black px-4 py-4">
          <h2 className="text-2xl text-white">Checkout is unlocked</h2>
          <Link href="/vip/checkout" className="mt-3 inline-flex text-[#CBF805] underline">
            Continue to checkout
          </Link>
        </section>
      ) : phase === "member" ? (
        <p className="text-sm">You&apos;re on VIP Coaching.</p>
      ) : phase === "waitlist" ? (
        <section className="space-y-3 rounded-2xl border border-line bg-card px-4 py-4">
          <h2 className="text-2xl">Limited spots</h2>
          <p className="text-sm text-muted">
            Intake is paused. Join the waitlist. If a spot opens, it&apos;s held for you for 72 hours.
          </p>
          <WaitlistButton plan="coaching" />
        </section>
      ) : (
        <VipApplyForm />
      )}
      <Link href="/pricing" className="inline-flex text-sm text-[#CBF805] underline">
        Back to pricing
      </Link>
    </main>
  );
}
