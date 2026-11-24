import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { LegalLinks } from "@/components/LegalLinks";
import { getCurrentUser } from "@/lib/session";
import { supportEmail } from "@/lib/support";

export const metadata = {
  title: "Support · SVG Performance",
};

export default async function SupportPage() {
  const user = await getCurrentUser();
  const email = supportEmail();
  return (
    <div className="min-h-full bg-background text-foreground">
      <AppHeader email={user?.email} />
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-10">
        <p className="font-display text-xs uppercase tracking-[0.06em] text-accent">Help</p>
        <h1 className="text-3xl">Support</h1>
        <p className="text-sm leading-relaxed">
          Email{" "}
          <a href={`mailto:${email}`} className="text-accent underline">
            {email}
          </a>
          . We reply as soon as we can, usually within two business days.
        </p>
        <section className="space-y-3 text-sm leading-relaxed">
          <h2 className="text-lg">Common questions</h2>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              Account access: sign in at{" "}
              <Link href="/login" className="text-accent underline">
                Log in
              </Link>
              . Password reset is on that page when email delivery is on.
            </li>
            <li>
              Billing on the website is handled by Stripe. Open Plan and Manage billing while signed in on the web.
            </li>
            <li>
              Billing in the iPhone or Android app is handled by the App Store or Google Play. Use Restore Purchases on the paywall or in Profile, and cancel in your device settings.
            </li>
            <li>
              Delete your account from Profile, or follow the steps on{" "}
              <Link href="/delete-account" className="text-accent underline">
                Delete your account
              </Link>
              .
            </li>
            <li>
              SVG MMA Academy membership is matched from academy records. Email support from the same address that is on the academy account.
            </li>
          </ul>
          <p>
            Academy front desk questions stay with SVG MMA Academy. This inbox is for the SVG Performance app.
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
