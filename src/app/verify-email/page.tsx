import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { VerifyEmailForm } from "@/components/gymdesk/VerifyEmailForm";
import { requireUser } from "@/lib/session";
import { getProfileForUser } from "@/lib/profile";
import { isSmtpConfigured } from "@/lib/mail";

export default async function VerifyEmailPage() {
  const user = await requireUser();
  const profile = await getProfileForUser(user.id);

  return (
    <div className="min-h-dvh bg-white text-black">
      <AppHeader email={user.email} role={user.role} homeHref="/verify-email" hideMemberLinks />
      <main className="mx-auto max-w-md px-4 py-10">
        <p className="font-display text-sm uppercase tracking-[0.12em] text-black">
          SVG MMA Academy
        </p>
        <h1 className="font-display mt-2 text-4xl uppercase leading-none">
          Confirm your email
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-muted">
          Member pricing uses academy records. We email a 6-digit code so you prove you own
          this address, then we match it.
        </p>
        {!isSmtpConfigured() ? (
          <p className="mt-4 rounded-2xl border border-line bg-card px-4 py-3 text-sm">
            Email sending is not configured on this preview. Ask a coach to verify you, or
            add SMTP settings.
          </p>
        ) : (
          <VerifyEmailForm
            email={user.email}
            alreadyVerified={Boolean(profile?.emailVerifiedAt)}
          />
        )}
        <p className="mt-8 text-sm text-muted">
          <Link href="/profile" className="text-accent underline-offset-4 hover:underline">
            Back to profile
          </Link>
        </p>
      </main>
    </div>
  );
}
