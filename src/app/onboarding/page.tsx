import { redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { OnboardingForm } from "@/components/onboarding/OnboardingForm";
import { getOnboardingStatus } from "@/lib/onboarding";
import { requireUser } from "@/lib/session";

export default async function OnboardingPage() {
  const user = await requireUser();
  const status = await getOnboardingStatus(user.id);
  if (status.completed) {
    redirect("/home");
  }
  if (!status.profile) {
    redirect("/login");
  }

  return (
    <div className="min-h-full">
      <AppHeader email={user.email} role={user.role} homeHref="/onboarding" hideMemberLinks />
      <main className="mx-auto max-w-md px-4 py-8">
        <h1 className="text-2xl font-semibold">A few vital questions</h1>
        <p className="mt-2 text-sm text-muted">
          We&apos;ll use this to tailor your app experience — Learn level, Home
          suggestions, and units. This is not a custom Elite coaching plan.
        </p>
        <div className="mt-6">
          <OnboardingForm profile={status.profile} />
        </div>
      </main>
    </div>
  );
}
