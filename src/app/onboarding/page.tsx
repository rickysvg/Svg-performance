import { redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { OnboardingForm } from "@/components/onboarding/OnboardingForm";
import { getOnboardingStatus } from "@/lib/onboarding";
import { requireUser } from "@/lib/session";
import { MEMBER_PRO_DAYS, NONMEMBER_TRIAL_DAYS } from "@/lib/pricing";

export default async function OnboardingPage() {
  const user = await requireUser();
  const status = await getOnboardingStatus(user.id);
  if (status.completed) {
    redirect(status.planChoiceAt ? "/home" : "/onboarding/plan");
  }
  if (!status.profile) {
    redirect("/login");
  }

  return (
    <div className="min-h-full">
      <AppHeader email={user.email} role={user.role} homeHref="/onboarding" hideMemberLinks />
      <main className="mx-auto max-w-md px-4 py-8">
        <h1 className="text-2xl">A few vital questions</h1>
        <p className="mt-2 text-sm text-muted">
          We&apos;ll use this to tailor your app — Learn level, Home
          suggestions, and units. For combat athletes, class training, and
          people getting in shape. After this, athletes who are not SVG Academy members
          start a {NONMEMBER_TRIAL_DAYS}-day Pro trial (no card). Verified members start Pro
          free for {MEMBER_PRO_DAYS} days, no card, never auto-billed. An optional two-minute screen can be skipped. This
          is not a custom Elite coaching plan.
        </p>
        <div className="mt-6">
          <OnboardingForm profile={status.profile} email={user.email} />
        </div>
      </main>
    </div>
  );
}
