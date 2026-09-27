import { requireUser } from "@/lib/session";
import { canUseFeature } from "@/lib/entitlements";
import { getTrialState } from "@/lib/trial";
import { getProfileForUser, timeZoneForUser } from "@/lib/profile";
import {
  FORM_CHECK_MONTHLY_LIMIT,
  FORM_CHECK_TURNAROUND,
  formCheckUsage,
  listFormChecksForUser,
  presentFormCheckForAthlete,
  unseenFormCheckCount,
} from "@/lib/form-check";
import { formCheckStorageNotice } from "@/lib/form-check-storage";
import { UpgradePreview } from "@/components/upgrade/UpgradePreview";
import { ProPill } from "@/components/pro/ProPill";
import { PageBackLink } from "@/components/fight-camp/PageBackLink";
import { FormCheckUploadForm } from "@/components/form-check/FormCheckUploadForm";
import { FormCheckSeenMarker } from "@/components/form-check/FormCheckSeenMarker";

export default async function FormCheckPage() {
  const user = await requireUser();
  const allowed = await canUseFeature(user.id, "form_check");
  if (!allowed) {
    const trial = await getTrialState(user.id);
    return (
      <main className="space-y-6">
        <div className="flex items-center gap-3">
          <PageBackLink />
          <h1 className="text-2xl">Form check</h1>
          <ProPill />
        </div>
        <UpgradePreview
          kind="form_check"
          canStartTrial={trial.canStartTrial}
          trialDays={trial.trialLengthDays}
          next="/form-check"
        />
      </main>
    );
  }

  const profile = await getProfileForUser(user.id);
  const timeZone = await timeZoneForUser(user.id, profile?.timeZone ?? null);
  const now = new Date();
  const [usage, rows, unseen] = await Promise.all([
    formCheckUsage(user.id, now, timeZone),
    listFormChecksForUser(user.id),
    unseenFormCheckCount(user.id),
  ]);
  const checks = rows.map(presentFormCheckForAthlete);

  return (
    <main className="space-y-6">
      <FormCheckSeenMarker unseen={unseen} />
      <div className="flex items-center gap-3">
        <PageBackLink />
        <h1 className="text-2xl">Form check</h1>
        <ProPill />
      </div>
      <p className="text-sm text-muted">
        {usage.remaining} of {FORM_CHECK_MONTHLY_LIMIT} checks left this month. {FORM_CHECK_TURNAROUND}
      </p>
      <FormCheckUploadForm
        remaining={usage.remaining}
        limit={FORM_CHECK_MONTHLY_LIMIT}
        storageNotice={formCheckStorageNotice()}
      />
      <section className="space-y-3">
        <h2 className="text-lg">Past submissions</h2>
        {checks.length === 0 ? (
          <p className="rounded-[1.5rem] border border-line bg-card px-4 py-4 text-sm text-muted">
            No clips yet. Send a lift or a technique when you want a real coach to look.
          </p>
        ) : (
          <ul className="space-y-3">
            {checks.map((check) => (
              <li key={check.id} className="rounded-[1.5rem] border border-line bg-white px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-display text-lg uppercase tracking-wide">{check.movement}</p>
                    <p className="mt-1 text-xs text-muted">
                      {formatWhen(check.submittedAt, timeZone)} · {check.durationSeconds}s
                    </p>
                  </div>
                  <StatusPill status={check.status} label={check.statusLabel} />
                </div>
                {check.note ? <p className="mt-3 text-sm">{check.note}</p> : null}
                <video
                  controls
                  preload="metadata"
                  className="mt-3 aspect-video w-full rounded-2xl bg-black"
                  src={`/api/form-checks/${check.id}`}
                />
                {check.reviewerLabel && check.feedback ? (
                  <blockquote className="mt-3 rounded-2xl bg-card px-4 py-3 text-sm">
                    <p className="font-display text-xs uppercase tracking-wide">{check.reviewerLabel}</p>
                    <p className="mt-2">“{check.feedback}”</p>
                  </blockquote>
                ) : (
                  <p className="mt-3 text-sm text-muted">{FORM_CHECK_TURNAROUND}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function StatusPill({ status, label }: { status: string; label: string }) {
  const className =
    status === "reviewed"
      ? "bg-accent text-black"
      : status === "in_review"
        ? "border border-black bg-white text-black"
        : "bg-black text-white";
  return (
    <span className={`inline-flex shrink-0 rounded-full px-2.5 py-1 font-display text-[11px] uppercase tracking-wide ${className}`}>
      {label}
    </span>
  );
}

function formatWhen(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    timeZone,
  }).format(date);
}
