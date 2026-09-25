import { redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { PlanChoiceForm } from "@/components/onboarding/PlanChoiceForm";
import { getOnboardingStatus } from "@/lib/onboarding";
import { requireUser } from "@/lib/session";
import { getTrialState } from "@/lib/trial";

export default async function OnboardingPlanPage() {
  const user = await requireUser();
  const status = await getOnboardingStatus(user.id);
  if (!status.completed) {
    redirect("/onboarding");
  }
  if (status.planChoiceAt) {
    redirect(status.deepCompleted ? "/home" : "/onboarding/deeper");
  }

  const trial = await getTrialState(user.id);

  return (
    <div className="min-h-full bg-white">
      <AppHeader email={user.email} role={user.role} homeHref="/onboarding/plan" hideMemberLinks />
      <main className="mx-auto max-w-md px-4 py-8">
        <PlanChoiceForm verified={trial.verified} trialDays={trial.trialLengthDays} />
      </main>
    </div>
  );
}
