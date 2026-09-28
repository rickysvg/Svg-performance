import Link from "next/link";
import { requireAdmin } from "@/lib/roles";
import { listUsersForAdmin } from "@/lib/admin";
import { listGymdeskAdminSnapshot } from "@/lib/gymdesk/csv-apply";
import {
  gymdeskMissingSecrets,
  gymdeskPublicOrigin,
  gymdeskWebhookSecret,
  gymdeskWebhookUrls,
  isGymdeskSyncEnabled,
} from "@/lib/gymdesk/config";
import { AdminVerifyForm } from "@/components/admin/AdminVerifyForm";
import { GymdeskCsvPanel } from "@/components/gymdesk/GymdeskCsvPanel";
import { WebhookUrlPanel } from "@/components/gymdesk/WebhookUrlPanel";
import {
  approveGymdeskQueueAction,
  dismissGymdeskQueueAction,
} from "@/app/actions/gymdesk";

function metaValue(
  meta: { key: string; value: string; at: Date }[],
  key: string,
) {
  return meta.find((row) => row.key === key) ?? null;
}

function formatWhen(date: Date | null | undefined) {
  if (!date) return "never";
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function AdminGymdeskPage() {
  await requireAdmin();
  const [snapshot, users] = await Promise.all([
    listGymdeskAdminSnapshot(),
    listUsersForAdmin(),
  ]);
  const origin = gymdeskPublicOrigin();
  const urls = gymdeskWebhookUrls(origin);
  const missing = gymdeskMissingSecrets();
  const enabled = isGymdeskSyncEnabled();
  const lastCsv = metaValue(snapshot.meta, "csv:last");
  const statuses = ["active", "frozen", "canceled", "visitor", "pending"] as const;

  return (
    <main className="space-y-6">
      <div>
        <Link href="/admin" className="text-sm text-accent underline">
          Back to toolkit
        </Link>
        <h1 className="mt-2 text-2xl">Gymdesk roster</h1>
        <p className="mt-1 text-sm text-muted">
          Read-only match against SVG MMA Academy records. This app never writes to Gymdesk.
        </p>
      </div>

      {!enabled || missing.length > 0 ? (
        <section className="rounded-2xl border border-black bg-accent p-4 text-sm text-black">
          {!enabled ? (
            <p>
              Gymdesk sync is off. Set GYMDESK_WEBHOOK_SECRET and GYMDESK_MATCH_PEPPER, or
              turn GYMDESK_SYNC_ENABLED on.
            </p>
          ) : null}
          {missing.length > 0 ? (
            <p className="mt-1">Missing env: {missing.join(", ")}.</p>
          ) : null}
        </section>
      ) : null}

      <section id="roster" className="space-y-3 rounded-2xl border border-line bg-card p-5">
        <h2 className="text-lg">Roster status</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {statuses.map((status) => (
            <div key={status} className="rounded-xl border border-line bg-background p-3">
              <p className="text-xs uppercase tracking-wide text-muted">{status}</p>
              <p className="mt-1 text-2xl font-semibold">{snapshot.rosterCounts[status] ?? 0}</p>
            </div>
          ))}
        </div>
        <ul className="space-y-1 text-sm text-muted">
          <li>Last CSV: {formatWhen(lastCsv?.at)} {lastCsv ? `(${lastCsv.value} rows)` : ""}</li>
          {urls.map((row) => {
            const last = metaValue(snapshot.meta, `webhook:${row.event}`);
            return (
              <li key={row.event}>
                Last {row.label}: {formatWhen(last?.at)}
              </li>
            );
          })}
        </ul>
      </section>

      <GymdeskCsvPanel />

      <section id="queue" className="space-y-3 rounded-2xl border border-line bg-card p-5">
        <h2 className="text-lg">Suggested match + conflict queue</h2>
        {snapshot.queue.length === 0 ? (
          <p className="text-sm text-muted">Queue is empty.</p>
        ) : (
          <ul className="space-y-3">
            {snapshot.queue.map((item) => (
              <li key={item.id} className="rounded-xl border border-line bg-background p-3 text-sm">
                <p className="font-medium">
                  {item.kind === "suggested" ? "Suggested match" : "Conflict"} · {item.reason}
                </p>
                <p className="text-muted">
                  {item.user.email}
                  {item.member ? ` → ${item.member.displayLabel} (${item.member.status})` : ""}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <form action={approveGymdeskQueueAction}>
                    <input type="hidden" name="queueId" value={item.id} />
                    <button
                      type="submit"
                      className="touch-target rounded-full bg-accent px-4 text-black"
                    >
                      Approve
                    </button>
                  </form>
                  <form action={dismissGymdeskQueueAction}>
                    <input type="hidden" name="queueId" value={item.id} />
                    <button
                      type="submit"
                      className="touch-target rounded-full border border-line px-4"
                    >
                      Dismiss
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3 rounded-2xl border border-line bg-card p-5">
        <h2 className="text-lg">Gym-price sub, member lapsed</h2>
        {snapshot.flaggedGymSubs.length === 0 ? (
          <p className="text-sm text-muted">None right now. We do not auto-change Stripe.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {snapshot.flaggedGymSubs.map((row) => (
              <li key={row.id} className="rounded-xl border border-line bg-background p-3">
                {row.user.email} · {row.plan} / {row.status}
              </li>
            ))}
          </ul>
        )}
      </section>

      <WebhookUrlPanel urls={urls} secretConfigured={Boolean(gymdeskWebhookSecret())} />

      <section id="overrides" className="space-y-3">
        <h2 className="text-lg">Per-user override</h2>
        <ul className="space-y-3">
          {users.map((user) => (
            <li key={user.id} className="rounded-2xl border border-line bg-card p-4">
              <p className="font-semibold">{user.email}</p>
              <p className="text-sm text-muted">
                Source: {user.profile?.gymMembershipSource || "none"} · Gymdesk status:{" "}
                {user.profile?.gymdeskStatus || "—"}
              </p>
              <AdminVerifyForm
                userId={user.id}
                verified={Boolean(user.profile?.gymMembershipVerified)}
                override={user.profile?.gymMembershipOverride ?? "none"}
                note={user.profile?.gymMembershipOverrideNote ?? ""}
              />
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
