import { DemoBadge } from "@/components/DemoBadge";
import { HeartImportForm } from "@/components/heart/HeartImportForm";
import { loadDemoHeartAction } from "@/app/actions/heart";
import type { getHeartDeviceStatus } from "@/lib/heart";

type Status = Awaited<ReturnType<typeof getHeartDeviceStatus>>;

export function AppleHealthCard({
  status: _status,
  message,
}: {
  status: Status;
  message?: string;
}) {
  return (
    <section className="space-y-4 rounded-2xl border border-accent/40 bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2>Connect Apple Health</h2>
          <p className="mt-1 text-sm text-muted">
            The web app cannot fully pair an Apple Watch. Import a Health export,
            Shortcuts file, or watch workout here. Automatic Watch sync is Phase 2
            (native iOS companion / HealthKit).
          </p>
        </div>
        <span className="rounded-full border border-line px-2.5 py-1 text-xs text-muted">
          Watch not connected
        </span>
      </div>

      {message ? <p className="text-sm text-accent">{message}</p> : null}

      <ol className="list-decimal space-y-2 pl-5 text-sm text-muted">
        <li>On iPhone, open Health, Health Auto Export, or Shortcuts.</li>
        <li>
          Export resting heart rate and workouts as JSON or CSV, or share an
          Apple Health <code>export.xml</code>.
        </li>
        <li>Import that file below. We label it Apple Health / watch workout import.</li>
        <li>We do not show Apple Watch as connected unless a native HealthKit bridge exists.</li>
      </ol>

      <HeartImportForm />

      <form action={loadDemoHeartAction}>
        <button
          type="submit"
          className="inline-flex items-center gap-2 text-sm text-accent underline-offset-4 hover:underline"
        >
          Load DEMO heart-rate samples <DemoBadge />
        </button>
      </form>
    </section>
  );
}
