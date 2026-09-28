import Link from "next/link";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { PlanChoiceForm } from "@/components/onboarding/PlanChoiceForm";
import { getOnboardingStatus } from "@/lib/onboarding";
import { requireUser } from "@/lib/session";
import { getTrialState } from "@/lib/trial";
import { getProfileForUser } from "@/lib/profile";
import { isGymdeskSyncEnabled } from "@/lib/gymdesk/config";

export default async function OnboardingPlanPage() {
  const user = await requireUser();
  const status = await getOnboardingStatus(user.id);
  if (!status.completed) {
    redirect("/onboarding");
  }
  if (status.planChoiceAt) {
    redirect(status.deepCompleted ? "/home" : "/onboarding/deeper");
  }

  const [trial, profile] = await Promise.all([getTrialState(user.id), getProfileForUser(user.id)]);

  return (
    <div className="min-h-full bg-white">
      <AppHeader email={user.email} role={user.role} homeHref="/onboarding/plan" hideMemberLinks />
      <main className="mx-auto max-w-md px-4 py-8">
        {isGymdeskSyncEnabled() && !profile?.emailVerifiedAt ? (
          <p className="mb-4 text-sm">
            <Link href="/verify-email" className="text-accent underline-offset-4 hover:underline">
              Confirm your email
            </Link>{" "}
            before starting a trial so we can match academy records for the 14-day member trial.
          </p>
        ) : null}
        <PlanChoiceForm verified={trial.verified} trialDays={trial.trialLengthDays} />
      </main>
    </div>
  );
}
