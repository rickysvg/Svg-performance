import Link from "next/link";
import { requireUser } from "@/lib/session";
import { VIP_LABEL, VIP_REPLY_PROMISE, vipPriceCopy } from "@/lib/vip-coaching";
import { getVipCheckoutView } from "@/lib/vip-store";
import { VipCheckoutButton } from "@/components/vip/VipCheckoutButton";

export default async function VipCheckoutPage() {
  const user = await requireUser();
  const view = await getVipCheckoutView(user.id);
  const copy = view ? vipPriceCopy(view.quote) : null;

  return (
    <main className="mx-auto max-w-lg space-y-5 pb-8" data-vip-checkout-page="1">
      <p className="font-display text-xs uppercase tracking-[0.14em] text-[#CBF805]">{VIP_LABEL}</p>
      <h1 className="text-4xl">Checkout</h1>
      {view && copy ? (
        <section className="space-y-4 rounded-2xl border border-[#CBF805]/50 bg-black px-4 py-5 text-white">
          <p className="font-display text-4xl text-[#CBF805]">{copy.primary}</p>
          <p className="text-sm text-white/80">{copy.detail}</p>
          <p className="text-sm text-white/80">{VIP_REPLY_PROMISE}</p>
          <ul className="space-y-1 text-sm text-white/85">
            <li>A program Ricky writes</li>
            <li>Direct messages with Ricky</li>
            <li>Replies within 48 hours</li>
          </ul>
          <VipCheckoutButton />
        </section>
      ) : (
        <section className="rounded-2xl border border-line bg-card px-4 py-4">
          <h2 className="text-2xl">Checkout is locked</h2>
          <p className="mt-2 text-sm text-muted">
            Ricky approves your application first. Then this checkout link opens for you.
          </p>
          <Link href="/vip/apply" className="mt-3 inline-flex text-[#CBF805] underline">
            Apply for VIP Coaching
          </Link>
        </section>
      )}
    </main>
  );
}
