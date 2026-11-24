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
        <p className="text-sm text-muted">Last updated November 24, 2026.</p>
        <section className="space-y-3 text-sm leading-relaxed">
          <p>
            SVG Performance is operated by SVG &amp; CO. COMBAT SPORTS &amp; FITNESS, LLC
            (“SVG”, “we”). The app is at{" "}
            <a href="https://svgperformance.app" className="text-accent underline">
              https://svgperformance.app
            </a>
            . Questions about this policy:{" "}
            <a href={`mailto:${supportEmail()}`} className="text-accent underline">
              {supportEmail()}
            </a>
            .
          </p>
          <h2 className="pt-2 text-lg">What this app is</h2>
          <p>
            SVG Performance is a training app and web app for logging training, timers, class programming,
            progress, and optional coach chat. It is a fitness log, not a medical service. It is not for anyone under 18.
          </p>
          <h2 className="pt-2 text-lg">Information we collect</h2>
          <ul className="list-disc space-y-2 pl-5">
            <li>Account data: email address, display name, and a password hash. We do not store your password in plain text.</li>
            <li>Profile and training data you enter: goals, workouts, sets, notes, check-ins, body weight, and optional photos or clips you upload. Camera and photo access are used only when you choose to add a photo or clip.</li>
            <li>
              Optional phone number, used only to suggest a match to SVG MMA Academy records. We store hashes for that match, not a copy of the academy roster, and we do not send your logs to Gymdesk.
            </li>
            <li>
              Billing data from Stripe on the web: customer id, subscription id, price id, plan, and status. Card numbers are collected by Stripe. We do not store full card numbers.
            </li>
            <li>
              Purchase records from Apple and Google when you subscribe in the iPhone or Android app: product, store, status, and renewal date. RevenueCat tells us whether that subscription is active. We do not receive your card number.
            </li>
            <li>Push tokens for reminders, when you turn notifications on, and a session cookie so you stay signed in.</li>
          </ul>
          <h2 className="pt-2 text-lg">AI coach</h2>
          <p>
            SVG Coach is powered by OpenAI. When you use it, we send your message, recent chat history,
            and training context to OpenAI to generate replies and optional spoken audio. That context
            can include experience level, goals, schedule, injury or limitation notes, fight-camp details,
            and plan or workout data when you ask about programming. Weekly check-in answers are sent too,
            if AI drafts are on. Under OpenAI&apos;s API terms, API data is not used to train their models.
            You can choose not to use the coach, and you can withdraw consent in Profile. Do not share
            medical details you want kept private.
          </p>
          <h2 className="pt-2 text-lg">How we use it</h2>
          <p>
            We use this information to run your account, show your training, apply academy membership
            and Pro access, process subscriptions, send reminders you turned on, and answer support email.
            We do not sell personal information. We do not use it for cross-app tracking.
          </p>
          <h2 className="pt-2 text-lg">Who we share it with</h2>
          <p>These processors act for us:</p>
          <ul className="list-disc space-y-2 pl-5">
            <li>OpenAI, for the AI coach and optional spoken replies.</li>
            <li>Stripe, for website payments.</li>
            <li>Apple and Google, for in-app purchases.</li>
            <li>RevenueCat, for subscription status from the App Store and Google Play.</li>
            <li>Vercel, for hosting and file storage (Vercel Blob).</li>
            <li>Our email delivery provider (SMTP or Mailchimp), for account and reminder email.</li>
            <li>Apple Push Notification service and Firebase Cloud Messaging, for notifications.</li>
            <li>Polar, only if you link a Polar account.</li>
            <li>YouTube, when a technique page embeds a YouTube video.</li>
          </ul>
          <p>
            We also share information if the law requires it, or to protect members and the service.
          </p>
          <h2 className="pt-2 text-lg">How long we keep it</h2>
          <p>
            We keep account and training data while your account is open. Profile can download a copy
            while Pro or the academy core app is open. Downloads stay off while a nonmember trial has
            ended unpaid or Pro is locked. You can delete the account from Profile, or follow the steps
            on the public delete-account page. Deleting the account removes your SVG Performance data.
            Stripe may keep billing records it is required to keep. Apple and Google keep their own purchase records.
            A store subscription is not canceled by deleting the account.
          </p>
          <h2 className="pt-2 text-lg">Your choices</h2>
          <p>
            You can update your profile, turn reminders off, skip optional phone matching, skip the AI coach,
            and email us to ask about your data. Academy membership is checked against gym records. Checking a
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
