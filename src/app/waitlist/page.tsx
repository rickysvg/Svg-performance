import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { WaitlistForm } from "@/components/waitlist/WaitlistForm";
import {
  WAITLIST_APPS_LINE,
  WAITLIST_EYEBROW,
  WAITLIST_FAQ,
  WAITLIST_HEADLINE_DATE,
  WAITLIST_HEADLINE_END,
  WAITLIST_HEADLINE_FIRST,
  WAITLIST_HEADLINE_LEAD,
  WAITLIST_HEADLINE_MID,
  WAITLIST_PRIVACY_BEFORE,
  WAITLIST_PRIVACY_LABEL,
  WAITLIST_SHARE_LINE,
  WAITLIST_SUBHEADLINE,
  WAITLIST_SUBHEADLINE_AFTER,
  WAITLIST_SUBHEADLINE_BEFORE,
  WAITLIST_SUBHEADLINE_DATE,
  WAITLIST_WEB_LINE,
} from "@/lib/waitlist-shared";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  metadataBase: new URL("https://svgperformance.app"),
  title: "Be first in. It drops Nov 16.",
  description: WAITLIST_SUBHEADLINE,
  alternates: { canonical: "/waitlist" },
  openGraph: {
    title: "Be first in. It drops Nov 16.",
    description: WAITLIST_SUBHEADLINE,
    url: "/waitlist",
    siteName: "SVG Performance",
    type: "website",
    images: [{ url: "/svg-performance-badge.webp", alt: "SVG Performance" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Be first in. It drops Nov 16.",
    description: WAITLIST_SUBHEADLINE,
    images: ["/svg-performance-badge.webp"],
  },
};

export const viewport: Viewport = {
  themeColor: "#000000",
};

function FaqAnswer({ answer }: { answer: string }) {
  const mark = "Book with Ricky";
  const index = answer.indexOf(mark);
  if (index === -1) return answer;
  return (
    <>
      {answer.slice(0, index)}
      <strong className="text-[#CBF805]">{mark}</strong>
      {answer.slice(index + mark.length)}
    </>
  );
}

export function WaitlistLanding() {
  return (
    <div className="min-h-full bg-black text-white">
      <main className="mx-auto flex w-full max-w-lg flex-col px-4 pb-16 pt-8 sm:px-6 sm:pt-12">
        <Link href="/" aria-label="SVG Performance" className="inline-flex w-fit">
          <Logo variant="mark" size="sm" priority />
        </Link>
        <p className="hc-kicker mt-8">{WAITLIST_EYEBROW}</p>
        <h1 className="mt-4 text-5xl text-white sm:text-6xl">
          {WAITLIST_HEADLINE_LEAD}
          <span className="text-[#CBF805]">{WAITLIST_HEADLINE_FIRST}</span>
          {WAITLIST_HEADLINE_MID}
          <span className="text-[#CBF805]">{WAITLIST_HEADLINE_DATE}</span>
          {WAITLIST_HEADLINE_END}
        </h1>
        <p className="mt-4 text-base leading-relaxed text-white/85">
          {WAITLIST_SUBHEADLINE_BEFORE}
          <span className="text-[#CBF805]">{WAITLIST_SUBHEADLINE_DATE}</span>
          {WAITLIST_SUBHEADLINE_AFTER}
        </p>
        <WaitlistForm />
        <p className="mt-6 text-sm leading-relaxed text-white/70">
          {WAITLIST_PRIVACY_BEFORE}{" "}
          <Link href="/privacy" className="text-[#CBF805] underline underline-offset-4">
            {WAITLIST_PRIVACY_LABEL}
          </Link>
        </p>
        <p className="mt-6 text-sm leading-relaxed text-white/80">{WAITLIST_WEB_LINE}</p>
        <p className="mt-1 text-sm leading-relaxed text-white/80">{WAITLIST_APPS_LINE}</p>
        <section className="mt-10" aria-label="FAQ">
          <h2 className="text-2xl text-white">FAQ</h2>
          <div className="mt-3 divide-y divide-white/15 border-y border-white/15">
            {WAITLIST_FAQ.map((item) => (
              <details key={item.question} className="group py-3">
                <summary className="cursor-pointer list-none text-base text-white [&::-webkit-details-marker]:hidden">
                  <span className="flex items-start justify-between gap-3">
                    <span>{item.question}</span>
                    <span aria-hidden className="text-[#CBF805] group-open:rotate-45">
                      +
                    </span>
                  </span>
                </summary>
                <p className="mt-2 text-sm leading-relaxed text-white/75">
                  <FaqAnswer answer={item.answer} />
                </p>
              </details>
            ))}
          </div>
        </section>
        <p className="mt-8 text-sm text-white/70">{WAITLIST_SHARE_LINE}</p>
      </main>
    </div>
  );
}

export default function WaitlistPage() {
  return <WaitlistLanding />;
}
