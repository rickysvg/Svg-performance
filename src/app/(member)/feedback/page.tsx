import { requireUser } from "@/lib/session";
import { getProfileForUser } from "@/lib/profile";
import { appVersionLabel, resolveFeedbackContext } from "@/lib/feedback";
import { feedbackStorageNotice } from "@/lib/feedback-storage";
import { isFeedbackType } from "@/lib/feedback-shared";
import { FeedbackForm } from "@/components/feedback/FeedbackForm";
import { PageBackLink } from "@/components/fight-camp/PageBackLink";

export default async function FeedbackPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; workout?: string; type?: string }>;
}) {
  const user = await requireUser();
  const profile = await getProfileForUser(user.id);
  const query = await searchParams;
  const context = await resolveFeedbackContext(user.id, {
    from: query.from,
    workout: query.workout,
  });
  const requestedType = query.type ?? "";
  const defaultType =
    isFeedbackType(requestedType) ? requestedType : context.workoutId ? "workout" : "";
  const backHref =
    context.route && context.route !== "/feedback" ? context.route.split("?")[0] || "/profile" : "/profile";

  return (
    <main className="space-y-6">
      <div className="flex items-center gap-3">
        <PageBackLink href={backHref} />
        <h1 className="text-2xl">Send feedback</h1>
      </div>
      <p className="text-sm text-muted">
        {profile?.tester
          ? "You're a tester. Send a bug, idea, or how a workout felt. Ricky reads these in the same inbox."
          : "Bug, idea, or how a workout felt. A screenshot is optional. The owner reads these after launch."}
      </p>
      <FeedbackForm
        route={context.route}
        workoutId={context.workoutId}
        appVersion={appVersionLabel()}
        defaultType={defaultType}
        storageNotice={feedbackStorageNotice()}
      />
    </main>
  );
}
