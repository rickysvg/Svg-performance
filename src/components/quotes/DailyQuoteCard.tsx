import Link from "next/link";
import type { DailyQuote } from "@/lib/quotes";

export function DailyQuoteCard({
  quote,
  unlocked,
  teaser,
}: {
  quote: DailyQuote;
  unlocked: boolean;
  teaser: string;
}) {
  return (
    <section className="rounded-[2rem] border border-line bg-card px-5 py-6">
      <p className="font-display text-xs font-semibold uppercase tracking-[0.16em] text-muted">
        Daily quote
      </p>
      {unlocked ? (
        <>
          <p className="mt-3 text-xl font-medium leading-snug">“{quote.text}”</p>
          <p className="mt-3 text-sm text-muted">{quote.attribution}</p>
        </>
      ) : (
        <>
          <p className="mt-3 text-xl font-medium leading-snug text-muted">“{teaser}”</p>
          <p className="mt-3 text-sm text-muted">
            Full daily quotes are on Performance+ (and higher paid catalog plans).
          </p>
          <Link
            href="/pricing"
            className="mt-4 inline-flex rounded-full bg-accent px-4 py-2 text-sm font-semibold text-black"
          >
            Upgrade
          </Link>
        </>
      )}
    </section>
  );
}
