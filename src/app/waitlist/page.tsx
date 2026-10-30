import type { Metadata } from "next";
import { DropCountdown } from "@/components/waitlist/DropCountdown";
import { WaitlistForm } from "@/components/waitlist/WaitlistForm";
import { ACADEMY_SITE, DROP_AT_ISO, readMailchimpConfig } from "@/lib/drop-waitlist";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Nov 16 drop",
  description: "Join the SVG Performance list for the Nov 16 drop.",
  robots: { index: false, follow: false },
};

export default function WaitlistPage() {
  const configured = readMailchimpConfig() !== null;

  return (
    <main className="mx-auto flex min-h-full max-w-md flex-col gap-6 px-4 py-8" data-waitlist-page>
      <header className="hc-panel hc-carbon px-4 py-6">
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-signal" aria-hidden />
          <p className="font-telemetry text-[10px] uppercase tracking-[0.18em] text-signal">Nov 16 drop</p>
        </div>
        <p className="hc-kicker mt-4">SVG Performance</p>
        <h1 className="mt-3 text-5xl">Get on the list</h1>
        <p className="mt-3 max-w-sm text-sm text-muted">
          The public drop opens Nov 16. Leave your email and we will send one confirmation through
          Mailchimp before anything else lands in your inbox.
        </p>
      </header>

      <DropCountdown dropAt={DROP_AT_ISO} />

      <section className="space-y-3">
        <h2 className="text-2xl">What&apos;s coming</h2>
        <ul className="space-y-2 text-sm text-muted">
          <li className="border border-[#243024] bg-black/35 px-3 py-3">
            The training week, logged sessions, and your progress in one app.
          </li>
          <li className="border border-[#243024] bg-black/35 px-3 py-3">
            SVG Coach for striking, grappling, and strength.
          </li>
          <li className="border border-[#243024] bg-black/35 px-3 py-3">
            Paid checkout opens Nov 16. Academy members and athletes anywhere.
          </li>
        </ul>
      </section>

      <WaitlistForm configured={configured} />

      <p className="text-sm text-muted">
        From{" "}
        <a href={ACADEMY_SITE} className="text-[#CBF805] underline-offset-4 hover:underline">
          SVG MMA Academy
        </a>
        .
      </p>
    </main>
  );
}
