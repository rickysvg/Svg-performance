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
    <section>
      {unlocked ? (
        <>
          <p className="text-lg leading-snug text-foreground">“{quote.text}”</p>
          <p className="mt-2 text-sm text-muted">{quote.attribution}</p>
        </>
      ) : (
        <>
          <p className="text-lg leading-snug text-muted">“{teaser}”</p>
          <p className="mt-2 text-sm text-muted">
            Full daily quotes are on Performance+ (and higher paid catalog plans).
          </p>
          <Link href="/pricing" className="mt-2 inline-block text-sm font-semibold text-accent">
            See App Plans
          </Link>
        </>
      )}
    </section>
  );
}
