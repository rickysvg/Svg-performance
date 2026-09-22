import Link from "next/link";
import { DemoBadge } from "@/components/DemoBadge";
import { disconnectPolarAction, loadDemoHeartAction, syncPolarAction } from "@/app/actions/heart";
import type { getHeartDeviceStatus } from "@/lib/heart";

type Status = Awaited<ReturnType<typeof getHeartDeviceStatus>>;

export function PolarConnectCard({
  status,
  message,
}: {
  status: Status;
  message?: string;
}) {
  return (
    <section className="space-y-3 rounded-2xl border border-line bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">Polar</h2>
          <p className="mt-1 text-sm text-muted">
            Phase 1 Polar-first. Apple Watch full sync is Phase 2 (HealthKit / native). We do
            not show Apple Watch as connected on the web.
          </p>
        </div>
        {status.polarConnected ? (
          <span className="rounded-full border border-accent px-2.5 py-1 text-xs font-semibold text-accent">
            Polar connected
          </span>
        ) : (
          <span className="rounded-full border border-line px-2.5 py-1 text-xs text-muted">
            Polar not connected
          </span>
        )}
      </div>

      {message ? <p className="text-sm text-accent">{message}</p> : null}

      {status.polarConfigured ? (
        status.polarConnected ? (
          <div className="space-y-3">
            <p className="text-sm text-muted">
              Last pull:{" "}
              {status.lastSyncedAt
                ? status.lastSyncedAt.toLocaleString()
                : "not yet — use Pull recent activities"}
            </p>
            {status.lastError ? <p className="text-sm text-danger">{status.lastError}</p> : null}
            <div className="flex flex-col gap-2 sm:flex-row">
              <form action={syncPolarAction}>
                <button
                  type="submit"
                  className="touch-target w-full rounded-full bg-accent px-4 font-semibold text-black sm:w-auto"
                >
                  Pull recent activities
                </button>
              </form>
              <form action={disconnectPolarAction}>
                <button
                  type="submit"
                  className="touch-target w-full rounded-full border border-line px-4 font-medium sm:w-auto"
                >
                  Disconnect Polar
                </button>
              </form>
            </div>
          </div>
        ) : (
          <Link
            href="/api/polar/connect"
            className="touch-target inline-flex items-center justify-center rounded-full bg-accent px-4 font-semibold text-black"
          >
            Connect Polar
          </Link>
        )
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted">
            Polar AccessLink is not configured on this preview. Add{" "}
            <code>POLAR_CLIENT_ID</code>, <code>POLAR_CLIENT_SECRET</code>, and{" "}
            <code>POLAR_REDIRECT_URI</code>, then restart. Until then the Connect button stays
            TEST-only.
          </p>
          <button
            type="button"
            disabled
            className="touch-target rounded-full border border-line px-4 font-medium text-muted"
          >
            Connect Polar (TEST)
          </button>
        </div>
      )}

      <div className="border-t border-line pt-3">
        <p className="text-xs text-muted">
          Apple Watch is not connected. You can type HR, import an Apple Health export / watch
          workout CSV, or load labeled DEMO samples.
        </p>
        <form action={loadDemoHeartAction} className="mt-3">
          <button
            type="submit"
            className="inline-flex items-center gap-2 text-sm text-accent underline-offset-4 hover:underline"
          >
            Load DEMO heart-rate samples <DemoBadge />
          </button>
        </form>
      </div>
    </section>
  );
}
