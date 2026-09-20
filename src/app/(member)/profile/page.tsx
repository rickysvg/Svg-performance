import Link from "next/link";
import { requireUser } from "@/lib/session";
import { getProfileForUser } from "@/lib/profile";
import { ProfileForm } from "@/components/profile/ProfileForm";
import { ChangePasswordForm } from "@/components/profile/ChangePasswordForm";

export default async function ProfilePage() {
  const user = await requireUser();
  const profile = await getProfileForUser(user.id);

  if (!profile) {
    return <p>Profile missing. Try logging out and back in.</p>;
  }

  return (
    <main className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Profile &amp; more</h1>
        <p className="mt-1 text-sm text-muted">{user.email}</p>
      </div>

      <ProfileForm profile={profile} />
      <ChangePasswordForm />

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Coming later</h2>
        <ul className="space-y-2 text-sm">
          <li>
            <Link href="/nutrition" className="text-accent underline-offset-4 hover:underline">
              Nutrition
            </Link>{" "}
            <span className="text-muted">— M2 stub</span>
          </li>
          <li>
            <Link href="/learn" className="text-accent underline-offset-4 hover:underline">
              Learn
            </Link>{" "}
            <span className="text-muted">— M2 stub</span>
          </li>
          <li>
            <Link href="/coach" className="text-accent underline-offset-4 hover:underline">
              Coach Savage AI
            </Link>{" "}
            <span className="text-muted">— M2 stub</span>
          </li>
          <li>
            <Link href="/pricing" className="text-accent underline-offset-4 hover:underline">
              Draft pricing
            </Link>{" "}
            <span className="text-muted">— proposal only</span>
          </li>
        </ul>
      </section>
    </main>
  );
}
