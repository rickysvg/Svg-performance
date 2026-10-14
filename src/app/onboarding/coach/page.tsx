import { redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { CoachChoiceForm } from "@/components/coach/CoachChoiceForm";
import { getOnboardingStatus } from "@/lib/onboarding";
import { requireUser } from "@/lib/session";

export default async function CoachOnboardingPage() {
  const user = await requireUser();
  const status = await getOnboardingStatus(user.id);
  if (!status.completed) {
    redirect("/onboarding");
  }
  if (!status.planChoiceAt) {
    redirect("/onboarding/plan");
  }
  if (!status.profile) {
    redirect("/login");
  }
  if (status.profile.coachChoiceAt) {
    redirect(status.deepCompleted ? "/home" : "/onboarding/deeper");
  }

  return (
    <div className="min-h-full">
      <AppHeader email={user.email} role={user.role} homeHref="/home" hideMemberLinks />
      <main className="mx-auto max-w-md px-4 py-8">
        <p className="text-xs uppercase tracking-wide text-muted">SVG Coach</p>
        <h1 className="mt-1 text-2xl">Pick your coach</h1>
        <p className="mt-2 text-sm text-muted">
          Six fictional coaches. The face and name show up in SVG Coach. The style
          changes the tone, not the safety rules. You can change both later in Profile.
        </p>
        <div className="mt-6">
          <CoachChoiceForm profile={status.profile} mode="onboarding" />
        </div>
      </main>
    </div>
  );
}
