import { redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { DeepOnboardingForm } from "@/components/onboarding/DeepOnboardingForm";
import { getOnboardingStatus } from "@/lib/onboarding";
import { requireUser } from "@/lib/session";

export default async function DeepOnboardingPage() {
  const user = await requireUser();
  const status = await getOnboardingStatus(user.id);
  if (!status.completed) {
    redirect("/onboarding");
  }
  if (!status.profile) {
    redirect("/login");
  }

  return (
    <div className="min-h-full">
      <AppHeader email={user.email} role={user.role} homeHref="/home" hideMemberLinks />
      <main className="mx-auto max-w-md px-4 py-8">
        <h1 className="text-2xl">Optional deeper profile</h1>
        <p className="mt-2 text-sm text-muted">
          About two minutes. Skip and you still land on Home. Answers stay editable in
          Profile. We use tone, session length, and competition flags honestly — we do
          not invent a medical plan from weight.
        </p>
        <div className="mt-6">
          <DeepOnboardingForm profile={status.profile} />
        </div>
      </main>
    </div>
  );
}
