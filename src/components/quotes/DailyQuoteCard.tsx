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
    <section className="rounded-2xl border border-line bg-card p-5">
      <p className="text-xs uppercase tracking-wide text-muted">Daily quote</p>
      {unlocked ? (
        <>
          <p className="mt-3 text-lg font-semibold leading-snug">“{quote.text}”</p>
          <p className="mt-2 text-xs text-muted">{quote.attribution} · changes each local day</p>
        </>
      ) : (
        <>
          <p className="mt-3 text-lg font-semibold leading-snug text-muted">“{teaser}”</p>
          <p className="mt-2 text-sm text-muted">
            Full daily quotes are on Performance+ (and higher paid catalog plans). Member Access
            gets this teaser.
          </p>
          <Link href="/pricing" className="mt-3 inline-block text-sm font-semibold text-accent underline">
            See App Plans
          </Link>
        </>
      )}
    </section>
  );
}
