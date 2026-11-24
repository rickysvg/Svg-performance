import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { LegalLinks } from "@/components/LegalLinks";
import { getCurrentUser } from "@/lib/session";
import { supportEmail } from "@/lib/support";

export const metadata = {
  title: "Delete your account · SVG Performance",
};

export default async function DeleteAccountInfoPage() {
  const user = await getCurrentUser();
  const email = supportEmail();
  return (
    <div className="min-h-full bg-background text-foreground">
      <AppHeader email={user?.email} />
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-10">
        <p className="font-display text-xs uppercase tracking-[0.06em] text-accent">Account</p>
        <h1 className="text-3xl">Delete your SVG Performance account</h1>
        <p className="text-sm text-muted">
          SVG Performance is operated by SVG &amp; CO. COMBAT SPORTS &amp; FITNESS, LLC.
        </p>
        <section className="space-y-3 text-sm leading-relaxed">
          <h2 className="text-lg">How to delete it</h2>
          <ol className="list-decimal space-y-2 pl-5">
            <li>Open SVG Performance in the app or on the web and sign in.</li>
            <li>Go to Profile, then Your data, then Delete account.</li>
            <li>Type DELETE or the account email to confirm.</li>
          </ol>
          <p>
            You can also email{" "}
            <a href={`mailto:${email}`} className="text-accent underline">
              {email}
            </a>{" "}
            from the account email and ask us to delete it.
          </p>
          <h2 className="pt-2 text-lg">What is deleted</h2>
          <p>
            We erase the account, profile, workout logs, photos, clips, coach chat, and the other
            data stored in SVG Performance. Stripe may keep billing records it is required to keep.
            Apple and Google keep their own purchase records.
          </p>
          <h2 className="pt-2 text-lg">Store subscriptions</h2>
          <p>
            Deleting the account does not cancel a subscription billed by the App Store or Google
            Play. Cancel that subscription in the device settings before you delete the account, or
            you can still be charged.
          </p>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <a href="https://support.apple.com/HT202039" className="text-accent underline">
                Manage App Store subscriptions
              </a>
            </li>
            <li>
              <a href="https://support.google.com/googleplay/answer/7018481" className="text-accent underline">
                Manage Google Play subscriptions
              </a>
            </li>
          </ul>
        </section>
        <LegalLinks />
        <Link href="/" className="inline-flex text-sm text-accent underline">
          Back
        </Link>
      </main>
    </div>
  );
}
