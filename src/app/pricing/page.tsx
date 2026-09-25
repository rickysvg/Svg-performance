import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { AiDisclaimer } from "@/components/billing/AiDisclaimer";
import { CheckoutButton } from "@/components/billing/CheckoutButton";
import { FinancingNote } from "@/components/billing/FinancingNote";
import { WaitlistButton } from "@/components/billing/WaitlistButton";
import { getCurrentUser } from "@/lib/session";
import { getProfileForUser } from "@/lib/profile";
import { getLatestSubscription, isStripeConfigured } from "@/lib/access";
import { getEffectivePlanId } from "@/lib/entitlements";
import { listSeatStatus } from "@/lib/waitlist";
import { BNPL_COPY, skuHighlightsFinancing } from "@/lib/bnpl";
import {
  BOOKING_OFFERS,
  type CatalogPlan,
  PLAN_CATALOG,
  plansInSection,
  publicSkusForPlan,
} from "@/lib/plans";
import { ACADEMY_PRICE_HINT, paidPlanPriceCopy } from "@/lib/trial";

function MemberPriceBlock({
  plan,
  verified,
}: {
  plan: CatalogPlan;
  verified: boolean;
}) {
  if (plan.id === "member_access") {
    return (
      <div className="mt-4">
        <p className="stat-display text-2xl font-semibold text-accent">
          {verified ? plan.gymPriceLabel : plan.nonmemberPriceLabel}
        </p>
        <p className="mt-1 text-sm text-muted">
          {verified
            ? "Included with your verified academy membership."
            : "Free preview of logging and beginner Learn."}
        </p>
      </div>
    );
  }
  const copy = paidPlanPriceCopy(plan, verified);
  return (
    <div className="mt-4">
      <p className="stat-display text-2xl font-semibold text-accent">{copy.headline}</p>
      {copy.perk ? <p className="mt-2 text-sm font-semibold text-black">{copy.perk}</p> : null}
      {copy.academyHint ? <p className="mt-2 text-xs text-muted">{ACADEMY_PRICE_HINT}</p> : null}
    </div>
  );
}

export default async function PricingPage() {
  const user = await getCurrentUser();
  const profile = user ? await getProfileForUser(user.id) : null;
  const subscription = user ? await getLatestSubscription(user.id) : null;
  const currentPlan = user ? await getEffectivePlanId(user.id) : null;
  const configured = isStripeConfigured();
  const seats = await listSeatStatus();
  const seatMap = new Map(seats.map((row) => [row.id, row]));
  const verified = Boolean(profile?.gymMembershipVerified);

  function checkoutDisabled(requiresGymVerify: boolean) {
    if (!user) return "Log in first.";
    if (!configured) return "Stripe TEST is not configured.";
    if (requiresGymVerify && !profile?.gymMembershipVerified) {
      return "Admin has not verified this gym membership yet.";
    }
    return undefined;
  }

  function renderPlan(plan: CatalogPlan) {
    const skus = publicSkusForPlan(plan.id);
    const seat = seatMap.get(plan.id as "elite" | "vip" | "platinum");
    const atCap = Boolean(seat?.atCap);
    return (
      <article key={plan.id} className="rounded-2xl border border-line bg-card p-6">
        <p className="font-display text-xs font-bold uppercase tracking-[0.16em] text-accent">
          PROPOSAL / TEST
        </p>
        <h3 className="mt-2 text-xl font-semibold">{plan.label}</h3>
        <p className="mt-2 text-sm text-muted">{plan.summary}</p>
        <MemberPriceBlock plan={plan} verified={verified} />
        {seat ? (
          <p className="mt-3 text-xs text-muted">
            Pilot seats: {seat.seats} / {seat.cap}
            {atCap ? " — full. Join the waitlist." : ""}
          </p>
        ) : null}
        {skus.some((sku) => skuHighlightsFinancing(sku.id)) ? (
          <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-accent">
            Pay over time when available
          </p>
        ) : null}
        {plan.responseTime ? (
          <p className="mt-2 text-sm">Human response: {plan.responseTime}</p>
        ) : null}
        <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-muted">
          {plan.includes.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <div className="mt-4 space-y-3">
          {skus.length === 0 ? (
            <p className="text-sm text-muted">
              No checkout. Gym members get this with membership. Others get a free preview
              of basic logging and beginner Learn notes.
            </p>
          ) : atCap ? (
            user ? (
              <WaitlistButton plan={plan.id} />
            ) : (
              <p className="text-sm text-muted">Log in to join the waitlist.</p>
            )
          ) : (
            skus
              .filter((sku) => {
                if (sku.audience === "both") return true;
                return verified ? sku.audience === "gym" : sku.audience === "nonmember";
              })
              .map((sku) => (
              <CheckoutButton
                key={sku.id}
                plan={sku.id}
                label={`Start ${sku.amountLabel} TEST checkout${
                  sku.audience === "gym"
                    ? " (gym)"
                    : sku.audience === "nonmember"
                      ? " (nonmember)"
                      : ""
                }`}
                disabledReason={checkoutDisabled(sku.requiresGymVerify)}
                financingHint={
                  skuHighlightsFinancing(sku.id) ? BNPL_COPY.whenAvailable : undefined
                }
              />
            ))
          )}
        </div>
      </article>
    );
  }

  return (
    <div className="min-h-full">
      <AppHeader email={user?.email} />
      <main className="mx-auto max-w-3xl px-4 py-10">
        <p className="font-display text-xs font-bold uppercase tracking-[0.2em] text-accent">
          Proposal / Stripe TEST only — not live billing
        </p>
        <h1 className="mt-2 text-3xl font-semibold">SVG Performance pricing</h1>
        <p className="mt-3 text-muted">
          Anyone can use this preview. SVG gym members may see member rates after
          an admin verifies them — checking a box does not unlock a price.
          Paid app plans are{" "}
          <strong className="text-foreground">additional to gym dues</strong> if
          you train at a gym. One monthly subscription at a time — a higher plan
          replaces the lower one. Cards and BNPL loan details never touch this
          app. Access is granted only after a verified webhook.
        </p>
        <AiDisclaimer className="mt-3" />
        <FinancingNote configured={configured} className="mt-4" />
        {currentPlan ? (
          <p className="mt-4 rounded-xl border border-line bg-card p-4 text-sm">
            Current catalog plan: <strong>{PLAN_CATALOG[currentPlan].label}</strong>
            {subscription
              ? ` · recorded ${subscription.plan} / ${subscription.status}`
              : " · no webhook row yet"}
            .{" "}
            <Link href="/plan" className="text-accent underline">
              See credits
            </Link>
          </p>
        ) : null}
        {!configured ? (
          <p className="mt-4 rounded-xl border border-accent/40 bg-accent/10 p-4 text-sm">
            Stripe TEST keys are not in this environment. Checkout buttons stay
            off on purpose so we do not fake paid access or an Affirm/Klarna buy.
          </p>
        ) : null}

        <section className="mt-10 space-y-4">
          <h2 className="text-2xl font-semibold">App Plans</h2>
          <p className="text-sm text-muted">
            Self-guided tools. Member Access is included / free preview. Fuel and SVG
            Coach unlock at Performance.
          </p>
          {plansInSection("app").map(renderPlan)}
        </section>

        <section className="mt-10 space-y-4">
          <h2 className="text-2xl font-semibold">Online Coaching</h2>
          <p className="text-sm text-muted">
            Fixed quantities per billing month — not “weekly forever.” Elite is capped
            at about 6 seats.
          </p>
          <AiDisclaimer />
          {plansInSection("coaching").map(renderPlan)}
        </section>

        <section className="mt-10 space-y-4">
          <h2 className="text-2xl font-semibold">VIP Experiences</h2>
          <p className="text-sm text-muted">
            Same price for gym members and nonmembers. Privates are a set count per
            billing month, not a weekly promise. Caps: 2 VIP, 1 Platinum.
          </p>
          <AiDisclaimer />
          {plansInSection("vip").map(renderPlan)}

          <article className="rounded-2xl border border-accent/40 bg-card p-6">
            <p className="font-display text-xs font-bold uppercase tracking-[0.16em] text-accent">
              PROPOSAL — request stub
            </p>
            <h3 className="mt-2 text-xl font-semibold">Platinum intensives</h3>
            <p className="mt-2 text-sm text-muted">
              {BOOKING_OFFERS.intensive_elpaso.summary} Not a live deposit.
              Intensives are a main pay-over-time use case, but this preview does
              not run Affirm or Klarna on Book stubs — we do not fake a purchase.
            </p>
            <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-muted">
              <li>
                You travel to El Paso: {BOOKING_OFFERS.intensive_elpaso.priceLabel}
              </li>
              <li>
                Ricky travels: {BOOKING_OFFERS.intensive_travel.priceLabel}
              </li>
              <li>Package: six 60-min privates across 3 days, three 30-min daily reviews, written plan, one 30-min follow-up</li>
            </ul>
            <Link
              href="/book"
              className="touch-target mt-4 inline-flex items-center rounded-full bg-accent px-5 font-semibold text-black"
            >
              Request on Book with Ricky
            </Link>
          </article>
        </section>

        <section className="mt-10 rounded-2xl border border-line bg-card p-6">
          <h2 className="text-lg font-semibold">Pricing FAQ / terms (placeholders)</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-muted">
            <li>Gym dues and SVG &amp; CO merch are separate from these app plans.</li>
            <li>Four privates means four in that billing month — not “every week.”</li>
            <li>Cancel or reschedule by sending a Book request. If Ricky cancels, we restore or extend that credit.</li>
            <li>Elite / VIP: human reply within 2 business days. Platinum: next business day. SVG Coach is not that inbox.</li>
            <li>Weight-cut services are not sold here.</li>
            <li>No launch discounts in this preview. TEST checkout never uses live keys.</li>
            <li>
              Affirm / Klarna approval is theirs, not SVG’s. We do not store loan
              details. Not everyone qualifies. US shoppers and Stripe amount
              minimums apply.
            </li>
          </ul>
        </section>

        <div className="mt-8 flex flex-wrap gap-4">
          <Link href={user ? "/home" : "/"} className="text-accent underline-offset-4 hover:underline">
            Back
          </Link>
          {user ? (
            <Link href="/book" className="text-accent underline-offset-4 hover:underline">
              Book with Ricky
            </Link>
          ) : null}
        </div>
      </main>
    </div>
  );
}
