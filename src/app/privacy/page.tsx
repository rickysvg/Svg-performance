import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { LegalLinks } from "@/components/LegalLinks";
import { getCurrentUser } from "@/lib/session";
import { supportEmail } from "@/lib/support";

export const metadata = {
  title: "Privacy policy · SVG Performance",
};

export default async function PrivacyPage() {
  const user = await getCurrentUser();
  return (
    <div className="min-h-full bg-background text-foreground">
      <AppHeader email={user?.email} />
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-10">
        <p className="font-display text-xs uppercase tracking-[0.06em] text-accent">Legal</p>
        <h1 className="text-3xl">Privacy policy</h1>
        <p className="text-sm text-muted">Last updated November 8, 2026.</p>
        <section className="space-y-3 text-sm leading-relaxed">
          <p>
            SVG Performance is operated by SVG &amp; CO. COMBAT SPORTS &amp; FITNESS, LLC
            (“SVG”, “we”). The app is at{" "}
            <a href="https://svg-performance.vercel.app" className="text-accent underline">
              https://svg-performance.vercel.app
            </a>
            . Questions about this policy:{" "}
            <a href={`mailto:${supportEmail()}`} className="text-accent underline">
              {supportEmail()}
            </a>
            .
          </p>
          <h2 className="pt-2 text-lg">What this app is</h2>
          <p>
            SVG Performance is a web app for logging training, timers, class programming, progress,
            and optional coach chat. It is a fitness log, not a medical service.
          </p>
          <h2 className="pt-2 text-lg">Information we collect</h2>
          <ul className="list-disc space-y-2 pl-5">
            <li>Account data: email address and a password hash. We do not store your password in plain text.</li>
            <li>Profile and training data you enter: goals, workouts, sets, notes, check-ins, and optional photos or clips you upload.</li>
            <li>
              Optional phone number, used only to suggest a match to SVG MMA Academy records. We store hashes for that match, not a copy of the academy roster, and we do not send your logs to Gymdesk.
            </li>
            <li>
              Billing data from Stripe: customer id, subscription id, price id, plan, and status. Card numbers are collected by Stripe. We do not store full card numbers.
            </li>
            <li>Technical data such as a session cookie so you stay signed in.</li>
          </ul>
          <h2 className="pt-2 text-lg">How we use it</h2>
          <p>
            We use this information to run your account, show your training, apply academy membership
            and Pro access, process subscriptions, and answer support email. We do not sell personal
            information.
          </p>
          <h2 className="pt-2 text-lg">Who we share it with</h2>
          <p>
            Stripe processes subscription payments. The app host stores the database and files needed
            to run SVG Performance. We share information if the law requires it, or to protect members
            and the service.
          </p>
          <h2 className="pt-2 text-lg">How long we keep it</h2>
          <p>
            We keep account and training data while your account is open. Profile can download a copy
            while Pro or the academy core app is open. Downloads stay off while a nonmember trial has
            ended unpaid or Pro is locked. You can delete the account from Profile. Deleting the account
            removes your SVG Performance data from the app. Stripe may keep billing records it is required to keep.
          </p>
          <h2 className="pt-2 text-lg">Your choices</h2>
          <p>
            You can update your profile, turn reminders off, skip optional phone matching, and email
            us to ask about your data. Academy membership is checked against gym records. Checking a
            box yourself does not verify membership.
          </p>
          <h2 className="pt-2 text-lg">Contact</h2>
          <p>
            SVG &amp; CO. COMBAT SPORTS &amp; FITNESS, LLC ·{" "}
            <a href={`mailto:${supportEmail()}`} className="text-accent underline">
              {supportEmail()}
            </a>
          </p>
        </section>
        <LegalLinks />
        <Link href="/" className="inline-flex text-sm text-accent underline">
          Back
        </Link>
      </main>
    </div>
  );
}
