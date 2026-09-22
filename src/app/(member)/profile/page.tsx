import Link from "next/link";
import { requireUser } from "@/lib/session";
import { getProfileForUser } from "@/lib/profile";
import { ProfileForm } from "@/components/profile/ProfileForm";
import { ChangePasswordForm } from "@/components/profile/ChangePasswordForm";
import { ReminderPrefsForm } from "@/components/reminders/ReminderPrefsForm";
import { isAdmin, isStaff } from "@/lib/roles";
import { getOrCreateReminderPrefs, isSmtpReminderDeliveryEnabled } from "@/lib/reminders";
import { EmptyState } from "@/components/EmptyState";

export default async function ProfilePage() {
  const user = await requireUser();
  const [profile, prefs] = await Promise.all([
    getProfileForUser(user.id),
    getOrCreateReminderPrefs(user.id),
  ]);

  if (!profile) {
    return (
      <EmptyState title="Profile missing">
        Try logging out and back in.
      </EmptyState>
    );
  }

  return (
    <main className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Profile</h1>
        <p className="mt-1 text-sm text-muted">
          {user.email}. Intake answers can be edited here anytime.
        </p>
      </div>

      <ProfileForm profile={profile} />
      <ReminderPrefsForm
        prefs={prefs}
        smtpConfigured={isSmtpReminderDeliveryEnabled()}
      />
      <ChangePasswordForm />

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">More</h2>
        <ul className="space-y-2 text-sm">
          <li>
            <Link href="/progress" className="text-accent underline-offset-4 hover:underline">
              Progress
            </Link>
          </li>
          <li>
            <Link href="/paths" className="text-accent underline-offset-4 hover:underline">
              Training paths
            </Link>
          </li>
          <li>
            <Link href="/journal" className="text-accent underline-offset-4 hover:underline">
              Coaching journal
            </Link>
          </li>
          <li>
            <Link href="/report" className="text-accent underline-offset-4 hover:underline">
              Weekly SVG report
            </Link>
          </li>
          <li>
            <Link href="/plan" className="text-accent underline-offset-4 hover:underline">
              My plan &amp; credits
            </Link>
          </li>
          <li>
            <Link href="/book" className="text-accent underline-offset-4 hover:underline">
              Book with Ricky
            </Link>
          </li>
          <li>
            <Link href="/pricing" className="text-accent underline-offset-4 hover:underline">
              Draft pricing (TEST)
            </Link>
          </li>
          {isStaff(user) ? (
            <li>
              <Link href="/staff/reports" className="text-accent underline-offset-4 hover:underline">
                Coach / admin reports
              </Link>
            </li>
          ) : null}
          {isAdmin(user) ? (
            <li>
              <Link href="/admin" className="text-accent underline-offset-4 hover:underline">
                Admin
              </Link>
            </li>
          ) : null}
        </ul>
      </section>
    </main>
  );
}
