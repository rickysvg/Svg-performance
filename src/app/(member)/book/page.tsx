import { requireUser } from "@/lib/session";
import { getEffectivePlanId } from "@/lib/entitlements";
import { remainingCredit, creditsForCurrentPlan } from "@/lib/credits";
import { listBookingRequestsForUser, bookingLabel, bookingPrep } from "@/lib/bookings";
import { BookingRequestForm } from "@/components/bookings/BookingRequestForm";
import { AiDisclaimer } from "@/components/billing/AiDisclaimer";
import { BOOKING_OFFERS, PLAN_CATALOG, type BookingKind } from "@/lib/plans";
import Link from "next/link";

export default async function BookPage() {
  const user = await requireUser();
  const planId = await getEffectivePlanId(user.id);
  const [{ credits }, requests, strategyLeft] = await Promise.all([
    creditsForCurrentPlan(user.id),
    listBookingRequestsForUser(user.id),
    remainingCredit(user.id, "strategy_45"),
  ]);
  const plan = PLAN_CATALOG[planId];
  const vipOrPlatinum = planId === "vip" || planId === "platinum";
  const extraKinds: BookingKind[] = ["mindset", "entrepreneur"];
  const intensiveKinds: BookingKind[] =
    planId === "platinum" ? ["intensive_elpaso", "intensive_travel"] : [];

  return (
    <main className="space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-accent">
          Request only — not a live calendar
        </p>
        <h1 className="text-2xl font-semibold">Book with Ricky</h1>
        <p className="mt-2 text-sm text-muted">
          Fighter Mindset is $75 / 30 min. Entrepreneur Strategy is $125 / 45 min.
          Training check-ins stay on your coaching plan. No promised business results.
        </p>
        <AiDisclaimer className="mt-2" />
      </div>

      <section className="rounded-2xl border border-line bg-card p-5">
        <h2 className="font-semibold">Your plan</h2>
        <p className="mt-1 text-sm text-muted">
          {plan.label}
          {vipOrPlatinum
            ? ` · ${strategyLeft} included 45-min strategy credit${
                strategyLeft === 1 ? "" : "s"
              } left this billing month`
            : " · extras are paid requests (not charged in this preview)"}
        </p>
        {credits.length > 0 ? (
          <ul className="mt-3 list-disc pl-5 text-sm text-muted">
            {credits.map((row) => (
              <li key={row.id}>
                {row.label}: {row.remaining} of {row.allotted} left
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-muted">
            This plan has no monthly coaching credits.{" "}
            <Link href="/pricing" className="text-accent underline">
              See Online Coaching / VIP
            </Link>
          </p>
        )}
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        {extraKinds.map((kind) => {
          const offer = BOOKING_OFFERS[kind];
          return (
            <article key={kind} className="rounded-2xl border border-line bg-card p-5">
              <h2 className="text-lg font-semibold">{offer.label}</h2>
              <p className="mt-2 text-2xl font-semibold text-accent">
                {offer.priceLabel}
                <span className="text-base text-muted"> / {offer.duration}</span>
              </p>
              <p className="mt-2 text-sm text-muted">{offer.summary}</p>
              <p className="mt-3 text-xs font-semibold uppercase text-muted">Prepare</p>
              <ul className="mt-1 list-disc pl-5 text-sm text-muted">
                {bookingPrep(kind).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>
          );
        })}
      </section>

      <section className="rounded-2xl border border-line bg-card p-5">
        <h2 className="font-semibold">Request a mindset or strategy extra</h2>
        <p className="mt-1 text-sm text-muted">
          List a few preferred times. We do not invent Ricky&apos;s calendar.
          {vipOrPlatinum
            ? " If you still have an included strategy credit, this request will flag it."
            : null}
        </p>
        <div className="mt-4">
          <BookingRequestForm kinds={extraKinds} defaultKind="mindset" />
        </div>
      </section>

      <section className="rounded-2xl border border-accent/40 bg-card p-5">
        <h2 className="font-semibold">Platinum intensives</h2>
        <p className="mt-2 text-sm text-muted">
          El Paso: {BOOKING_OFFERS.intensive_elpaso.priceLabel}. Travel:{" "}
          {BOOKING_OFFERS.intensive_travel.priceLabel}. Request stub only — no
          deposit. Higher-ticket intensives are a main Affirm/Klarna use case
          once Stripe TEST checkout exists for them; this Book form does not
          fake a loan or a successful buy.
        </p>
        <ul className="mt-3 list-disc pl-5 text-sm text-muted">
          {bookingPrep("intensive_elpaso").map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        {intensiveKinds.length > 0 ? (
          <div className="mt-4">
            <BookingRequestForm kinds={intensiveKinds} defaultKind="intensive_elpaso" />
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted">
            Intensives are for Platinum members.{" "}
            <Link href="/pricing" className="text-accent underline">
              Read the Platinum section
            </Link>
          </p>
        )}
      </section>

      {requests.length > 0 ? (
        <section className="rounded-2xl border border-line bg-card p-5">
          <h2 className="font-semibold">Your requests</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {requests.map((row) => (
              <li key={row.id} className="border-t border-line pt-2 first:border-0 first:pt-0">
                <span className="font-medium">{bookingLabel(row.kind)}</span> · {row.status}
                {row.usesIncludedCredit ? " · uses included credit" : ""}
                <span className="block text-muted">{row.preferredTimes}</span>
                {row.nextSteps ? (
                  <span className="mt-1 block">
                    <span className="text-xs uppercase text-muted">Agreed next steps</span>
                    <span className="block whitespace-pre-wrap">{row.nextSteps}</span>
                  </span>
                ) : (
                  <span className="block text-xs text-muted">
                    Next steps stay empty until a coach writes them after the call.
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
