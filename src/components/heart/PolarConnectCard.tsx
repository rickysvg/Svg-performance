import Link from "next/link";
import { disconnectPolarAction, syncPolarAction } from "@/app/actions/heart";
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
          <h2 className="font-semibold">Polar (optional)</h2>
          <p className="mt-1 text-sm text-muted">
            Secondary to Apple Health. Connect Polar AccessLink if you use a Polar
            strap or watch. Apple Watch pairing is not this card.
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
            className="touch-target inline-flex items-center justify-center rounded-full border border-line px-4 font-medium"
          >
            Connect Polar
          </Link>
        )
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted">
            Polar is optional. Add <code>POLAR_CLIENT_ID</code>,{" "}
            <code>POLAR_CLIENT_SECRET</code>, and <code>POLAR_REDIRECT_URI</code> if you
            want AccessLink. Until then Connect Polar (TEST) stays off.
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
    </section>
  );
}
