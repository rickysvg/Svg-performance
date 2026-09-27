"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { WaitlistButton } from "@/components/billing/WaitlistButton";
import {
  academyPerkLine,
  appOffersForView,
  coachingOffersForView,
  COACHING_MONEY_BACK,
  COACHING_TERMS,
  priceHeadline,
  type OfferCard,
  type PricingView,
} from "@/lib/pricing";
import { PLAN_CATALOG, type CatalogPlan, type CatalogPlanId } from "@/lib/plans";

type SeatInfo = { id: string; seats: number; cap: number; atCap: boolean };

function ComingSoonButton() {
  return (
    <button
      type="button"
      disabled
      className="touch-target w-full rounded-full bg-accent text-black disabled:cursor-not-allowed disabled:opacity-60"
    >
      Coming soon
    </button>
  );
}

function OfferBlock({ offer, verified }: { offer: OfferCard; verified: boolean }) {
  const samePrice = offer.pair.member === offer.pair.regular;
  return (
    <div className="rounded-xl border border-line bg-white p-4" data-offer={offer.id}>
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-medium text-black">{offer.title}</p>
        {offer.badge ? (
          <span
            data-offer-badge={offer.badge}
            className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
              offer.badge === "Founding"
                ? "bg-accent text-black"
                : "border border-black bg-white text-black"
            }`}
          >
            {offer.badge}
          </span>
        ) : null}
      </div>
      <p className="font-display stat-display mt-2 text-2xl text-black">
        {priceHeadline(offer.pair, verified, offer.suffix)}
      </p>
      {samePrice ? null : (
        <p className="mt-1 text-sm text-muted">{academyPerkLine(offer.pair, offer.suffix)}</p>
      )}
      {offer.note ? <p className="mt-2 text-xs text-muted">{offer.note}</p> : null}
    </div>
  );
}

function PlanCard({
  plan,
  offers,
  verified,
  seat,
  userLoggedIn,
  extra,
}: {
  plan: CatalogPlan;
  offers: OfferCard[];
  verified: boolean;
  seat?: SeatInfo;
  userLoggedIn: boolean;
  extra?: ReactNode;
}) {
  const atCap = Boolean(seat?.atCap);
  return (
    <article
      data-plan-card={plan.id}
      className="flex h-full scroll-mt-32 flex-col rounded-2xl border border-line bg-card p-5"
    >
      <p className="font-display text-xs uppercase tracking-[0.06em] text-black">
        {plan.section === "vip" ? "One-time" : plan.section === "coaching" ? "Coaching" : "App"}
      </p>
      <h3 className="mt-2 text-xl text-black">{plan.label}</h3>
      <p className="mt-2 text-sm text-muted">{plan.summary}</p>
      {offers.length > 0 ? (
        <div className="mt-4 grid gap-3">
          {offers.map((offer) => (
            <OfferBlock key={offer.id} offer={offer} verified={verified} />
          ))}
        </div>
      ) : null}
      {extra}
      {seat ? (
        <p className="mt-3 text-xs text-muted">
          Pilot seats: {seat.seats} / {seat.cap}
          {atCap ? " — full. Join the waitlist." : ""}
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
      <div className="mt-5 mt-auto pt-4">
        {plan.id === "member_access" ? (
          <p className="text-sm text-muted">
            No checkout. Gym members get this with membership. Others get a free preview of
            basic logging and beginner Learn notes.
          </p>
        ) : atCap ? (
          userLoggedIn ? (
            <WaitlistButton plan={plan.id} />
          ) : (
            <p className="text-sm text-muted">Log in to join the waitlist.</p>
          )
        ) : (
          <ComingSoonButton />
        )}
      </div>
    </article>
  );
}

function ViewToggle({
  view,
  onChange,
}: {
  view: PricingView;
  onChange: (next: PricingView) => void;
}) {
  return (
    <div
      data-pricing-toggle
      className="sticky top-14 z-10 -mx-4 bg-white px-4 pb-3 pt-2"
    >
      <div
        role="tablist"
        aria-label="Billing term"
        className="grid grid-cols-2 rounded-full border border-black bg-white p-1"
      >
        {(["monthly", "prepay"] as const).map((id) => {
          const selected = view === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={selected}
              data-term-tab={id}
              onClick={() => onChange(id)}
              className={`touch-target rounded-full text-sm uppercase tracking-wide ${
                selected ? "bg-accent text-black" : "bg-white text-black"
              }`}
            >
              {id === "monthly" ? "Monthly" : "Prepay"}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function PricingCatalog({
  verified,
  foundingOpen,
  userLoggedIn,
  seats,
}: {
  verified: boolean;
  foundingOpen: boolean;
  userLoggedIn: boolean;
  seats: SeatInfo[];
}) {
  const [view, setView] = useState<PricingView>("monthly");
  const didMountView = useRef(false);
  const seatMap = new Map(seats.map((row) => [row.id, row]));
  const appOffers = appOffersForView(view, foundingOpen);
  const coachingOffers = coachingOffersForView(view);

  function seatFor(id: CatalogPlanId) {
    return seatMap.get(id);
  }

  useLayoutEffect(() => {
    if (!didMountView.current) {
      didMountView.current = true;
      return;
    }
    const bar = document.querySelector<HTMLElement>("[data-pricing-toggle]");
    if (!bar) return;
    const floor = bar.getBoundingClientRect().bottom;
    const cards = document.querySelectorAll<HTMLElement>("[data-plan-card]");
    for (const card of cards) {
      const rect = card.getBoundingClientRect();
      if (rect.bottom <= bar.getBoundingClientRect().top) continue;
      if (rect.top < floor) {
        card.scrollIntoView({ block: "start", behavior: "auto" });
      }
      break;
    }
  }, [view]);

  return (
    <div data-pricing-view={view} className="space-y-10">
      <ViewToggle view={view} onChange={setView} />

      <section data-pricing-section="app" className="scroll-mt-32 space-y-4">
        <h2 className="text-2xl text-black">App Plans</h2>
        <p className="text-sm text-muted">
          Self-guided tools. Member Access is free for verified academy members and a free
          preview for everyone else. Fuel and SVG Coach unlock at Performance. Verified
          members get a 14-day no-card trial. Others get 7 days. Paid billing is not live.
        </p>
        <div className="grid gap-4">
          <PlanCard
            plan={PLAN_CATALOG.member_access}
            offers={[]}
            verified={verified}
            userLoggedIn={userLoggedIn}
            extra={
              <div className="mt-4">
                <p className="font-display stat-display text-2xl text-black">
                  {verified ? "Free" : "Free preview"}
                </p>
                <p className="mt-1 text-sm text-muted">
                  {verified
                    ? "Included automatically with your verified academy membership."
                    : "Free preview of logging and beginner Learn."}
                </p>
              </div>
            }
          />
          <PlanCard
            plan={PLAN_CATALOG.performance}
            offers={appOffers.performance}
            verified={verified}
            userLoggedIn={userLoggedIn}
          />
          <PlanCard
            plan={PLAN_CATALOG.fighter_conditioning}
            offers={appOffers.fighter_conditioning}
            verified={verified}
            userLoggedIn={userLoggedIn}
          />
        </div>
      </section>

      <section data-pricing-section="coaching" className="scroll-mt-32 space-y-4">
        <h2 className="text-2xl text-black">Online Coaching</h2>
        <p className="text-sm text-muted">
          Fixed quantities per billing month — not “weekly forever.” Elite is capped at about
          6 seats. No free trial on coaching.
        </p>
        <div className="rounded-2xl border border-black bg-white p-5" data-coaching-terms>
          <p className="text-sm text-black">{COACHING_TERMS}</p>
          <p className="mt-2 text-sm font-medium text-black">{COACHING_MONEY_BACK}</p>
        </div>
        <div className="grid gap-4">
          <PlanCard
            plan={PLAN_CATALOG.fighter_development}
            offers={coachingOffers.fighter_development}
            verified={verified}
            userLoggedIn={userLoggedIn}
          />
          <PlanCard
            plan={PLAN_CATALOG.elite}
            offers={coachingOffers.elite}
            verified={verified}
            seat={seatFor("elite")}
            userLoggedIn={userLoggedIn}
          />
        </div>
      </section>

      <section data-pricing-section="vip" className="scroll-mt-32 space-y-4">
        <h2 className="text-2xl text-black">VIP Experiences</h2>
        <p className="text-sm text-muted">
          One-time. Same price for academy members and everyone else. In-person intensives
          are in El Paso. Caps: 2 VIP, 1 Platinum.
        </p>
        <div className="grid gap-4">
          <PlanCard
            plan={PLAN_CATALOG.vip}
            offers={[
              {
                id: "vip-once",
                title: "One-time",
                pair: { member: 699, regular: 699 },
                suffix: "",
              },
            ]}
            verified={verified}
            seat={seatFor("vip")}
            userLoggedIn={userLoggedIn}
          />
          <PlanCard
            plan={PLAN_CATALOG.platinum}
            offers={[
              {
                id: "platinum-once",
                title: "One-time",
                pair: { member: 1199, regular: 1199 },
                suffix: "",
              },
            ]}
            verified={verified}
            seat={seatFor("platinum")}
            userLoggedIn={userLoggedIn}
          />
        </div>
      </section>
    </div>
  );
}
