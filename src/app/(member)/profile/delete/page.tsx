import Link from "next/link";
import { requireUser } from "@/lib/session";
import { DeleteAccountForm } from "@/components/profile/DeleteAccountForm";

export default async function DeleteAccountPage() {
  const user = await requireUser();

  return (
    <main className="space-y-6">
      <div>
        <p className="font-display text-xs uppercase tracking-[0.06em] text-danger">
          Permanent
        </p>
        <h1 className="mt-1 text-3xl">Delete account</h1>
        <p className="mt-2 text-sm text-muted">
          This cannot be undone. {user.email} and everything tied to it will be
          erased from SVG Performance.
        </p>
      </div>

      <section className="space-y-3 rounded-2xl border border-danger/30 bg-card p-5">
        <h2 className="text-lg">What gets erased</h2>
        <ul className="list-disc space-y-2 pl-5 text-sm text-muted">
          <li>Your profile, intake answers, and gym-membership checkbox / verify flags.</li>
          <li>Workout logs and sets, notes, nutrition, heart samples, photos, and clips.</li>
          <li>Coach chat history, journal entries, reminders, and bookings.</li>
          <li>Your plan and membership status on this app. Any subscription is canceled, so you won&apos;t be charged again.</li>
        </ul>
        <p className="text-sm text-muted">
          Other members’ accounts stay. You will be signed out and sent to the
          landing page.
        </p>
      </section>

      <DeleteAccountForm email={user.email} />

      <p className="text-sm">
        <Link href="/profile" className="font-semibold underline-offset-4 hover:underline">
          Back to profile
        </Link>
      </p>
    </main>
  );
}
