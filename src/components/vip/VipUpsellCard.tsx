import Link from "next/link";
import { dismissVipUpsellAction } from "@/app/actions/vip";
import type { VipUpsellCard as Card } from "@/lib/vip-coaching";

export function VipUpsellCard({ card }: { card: Card }) {
  return (
    <section
      data-vip-upsell="1"
      data-vip-trigger={card.trigger}
      className="rounded-2xl border border-[#CBF805]/50 bg-black px-4 py-4 text-white"
    >
      <p className="font-display text-xs uppercase tracking-[0.14em] text-[#CBF805]">Coach Ricky</p>
      <h2 className="mt-2 text-2xl text-white">{card.title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-white/85">{card.body}</p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        {card.mode === "apply" ? (
          <Link
            href="/vip/apply"
            className="touch-target inline-flex items-center rounded-full bg-[#CBF805] px-4 font-semibold text-black"
          >
            {card.cta}
          </Link>
        ) : card.mode === "waitlist" ? (
          <Link
            href="/pricing"
            className="touch-target inline-flex items-center rounded-full bg-[#CBF805] px-4 font-semibold text-black"
          >
            {card.cta}
          </Link>
        ) : (
          <p className="text-sm font-medium text-[#CBF805]">{card.cta}</p>
        )}
        <form action={dismissVipUpsellAction}>
          <input type="hidden" name="trigger" value={card.trigger} />
          <button type="submit" className="touch-target text-sm text-white/70 underline">
            Not now
          </button>
        </form>
      </div>
    </section>
  );
}
