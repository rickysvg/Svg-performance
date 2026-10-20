import { compactQuoteLine } from "@/lib/quotes";

export function HomeDailyQuote({
  text,
  attribution = "",
}: {
  text: string;
  attribution?: string;
}) {
  const line = compactQuoteLine({ text, attribution });
  return (
    <p
      className="mt-2 line-clamp-2 max-w-[22rem] text-sm italic leading-snug text-white/80"
      data-daily-quote
    >
      <span className="sr-only">Quote of the day. </span>
      <span className="not-italic text-[#CBF805]" aria-hidden>
        “
      </span>
      {line.text}
      <span className="not-italic text-[#CBF805]" aria-hidden>
        ”
      </span>
      {line.attribution ? (
        <span className="not-italic text-[11px] font-medium tracking-wide text-[#CBF805]">
          {" "}
          {line.attribution}
        </span>
      ) : null}
    </p>
  );
}
