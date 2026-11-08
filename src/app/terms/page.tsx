import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { LegalLinks } from "@/components/LegalLinks";
import { getCurrentUser } from "@/lib/session";
import { supportEmail } from "@/lib/support";

export const metadata = {
  title: "Terms of use · SVG Performance",
};

export default async function TermsPage() {
  const user = await getCurrentUser();
  return (
    <div className="min-h-full bg-background text-foreground">
      <AppHeader email={user?.email} />
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-10">
        <p className="font-display text-xs uppercase tracking-[0.06em] text-accent">Legal</p>
        <h1 className="text-3xl">Terms of use</h1>
        <p className="text-sm text-muted">Last updated November 8, 2026.</p>
        <section className="space-y-3 text-sm leading-relaxed">
          <p>
            These terms cover SVG Performance, the training log at{" "}
            <a href="https://svg-performance.vercel.app" className="text-accent underline">
              https://svg-performance.vercel.app
            </a>
            , operated by SVG &amp; CO. COMBAT SPORTS &amp; FITNESS, LLC. By creating an account
            you agree to them. Contact{" "}
            <a href={`mailto:${supportEmail()}`} className="text-accent underline">
              {supportEmail()}
            </a>{" "}
            with questions.
          </p>
          <h2 className="pt-2 text-lg">Who can use it</h2>
          <p>You must be 18 or older. You are responsible for the activity on your account and for keeping your password private.</p>
          <h2 className="pt-2 text-lg">What the app provides</h2>
          <p>
            SVG Performance logs workouts, timers, and class programming, and may include coach chat.
            It is a training tool. It is not medical advice, and it does not replace a coach or a
            doctor. Stop and get help if you are in pain or injured. Weight-cut services are not sold
            here.
          </p>
          <h2 className="pt-2 text-lg">Plans and billing</h2>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              Athletes who are not verified SVG Academy members can start one Pro trial in the app with no card. It lasts 7 days. After it ends unpaid, or if Pro locks for non-payment, Train, workout logging, timers, the AI coach, and every workout download stay off. Workout history and progress stay viewable (read-only). There is no export while unpaid. Academy members keep the core app.
            </li>
            <li>
              One Pro trial per person. It is not stacked, and it is not offered again after you cancel and subscribe again. If you have never started a trial and you begin at checkout, that checkout can include the one trial (7 days, or 14 days for a verified academy member). If any part of the trial already started, checkout bills today.
            </li>
            <li>
              Pro is $9.99 per month or $72.99 per year. You can cancel in Manage billing at the end of the current period. No refunds, except when we made a billing error.
            </li>
            <li>
              Verified SVG Academy members get the core app with their gym dues, plus Pro free for 14 days, with no card and no automatic charge for that grant. After those days the account returns to the included tier unless you subscribe to Pro.
            </li>
            <li>
              VIP Coaching is $249 per month and includes Pro. It is billed today. There is no free trial. Verified academy members pay $149 the first month, then $249. A Pro subscriber who is not an academy member can get a one-time credit of up to $30. Academy members do not get that credit. Academy gym dues are billed by the gym and are not changed in this app.
            </li>
            <li>
              Stripe processes the payment. Access after checkout is confirmed by Stripe’s webhook, not by the browser page you return to. Paid features lock as soon as a subscription is past due, unpaid, or canceled. Add a card in Manage billing. Access opens again when the payment succeeds.
            </li>
          </ul>
          <h2 className="pt-2 text-lg">Acceptable use</h2>
          <p>
            Do not misuse the app, attempt to access another member’s data, or upload anything you do
            not have the right to share. We may suspend an account that abuses the service.
          </p>
          <h2 className="pt-2 text-lg">Changes</h2>
          <p>
            We can update the app and these terms. Continued use after an update means you accept the
            current terms. The date at the top of this page is the latest revision.
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
