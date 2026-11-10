import { requireDashboardAdmin } from "@/lib/admin-access";
import { listProAccessCodes, type AccessCodeStatus } from "@/lib/access-codes";
import { AdminScreen } from "@/components/admin/AdminChrome";
import { AccessCodeForm } from "@/components/admin/AccessCodeForm";
import { CopyCodeButton } from "@/components/admin/CopyCodeButton";
import { revokeAccessCodeAction } from "@/app/actions/access-code";
import { timeZoneForUser } from "@/lib/profile";
import { formatZonedDate } from "@/lib/timezone";

const STATUS_LABEL: Record<AccessCodeStatus, string> = {
  unused: "Unused",
  redeemed: "Redeemed",
  expired: "Expired",
  revoked: "Revoked",
};

function durationLabel(days: number | null) {
  if (days == null) return "No end date";
  return `${days} days`;
}

export default async function AdminAccessCodesPage() {
  const admin = await requireDashboardAdmin();
  const [codes, timeZone] = await Promise.all([
    listProAccessCodes(),
    timeZoneForUser(admin.id),
  ]);

  return (
    <AdminScreen
      kicker="Free Pro"
      title="Pro access codes"
      hint="One-time codes for fighters you pick. No card. Redeem at sign-up or in plan settings. Revoking a redeemed code removes Pro immediately."
    >
      <div data-testid="pro-access-codes" className="space-y-5">
        <AccessCodeForm />
        <section className="space-y-3">
          <h2 className="text-lg">Codes</h2>
          {codes.length === 0 ? (
            <p className="text-sm text-muted">No codes yet.</p>
          ) : (
            <ul className="space-y-3">
              {codes.map((row) => (
                <li key={row.id} className="hc-panel space-y-3 px-4 py-4" data-access-code-status={row.status}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-telemetry text-lg tracking-wide">{row.code}</p>
                      <p className="mt-1 text-sm text-muted">
                        {STATUS_LABEL[row.status]}
                        {row.label ? ` · ${row.label}` : ""}
                        {row.emailLock ? ` · only ${row.emailLock}` : " · any email"}
                        {` · ${durationLabel(row.durationDays)}`}
                      </p>
                      {row.redeemedAt ? (
                        <p className="mt-1 text-sm text-muted">
                          Redeemed{row.redeemedByEmail ? ` by ${row.redeemedByEmail}` : ""} on{" "}
                          {formatZonedDate(row.redeemedAt, timeZone)}
                        </p>
                      ) : null}
                      <p className="mt-1 text-sm text-muted">
                        {row.status === "unused"
                          ? "Expires: not started"
                          : row.expiresAt
                            ? `Expires ${formatZonedDate(row.expiresAt, timeZone)}`
                            : "Expires: no end date"}
                        {row.revokedAt ? ` · revoked ${formatZonedDate(row.revokedAt, timeZone)}` : ""}
                      </p>
                    </div>
                    <CopyCodeButton code={row.code} />
                  </div>
                  {row.status !== "revoked" ? (
                    <form action={revokeAccessCodeAction}>
                      <input type="hidden" name="codeId" value={row.id} />
                      <button type="submit" className="min-h-11 text-sm text-[#FF3B3B] underline">
                        Revoke
                      </button>
                    </form>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </AdminScreen>
  );
}
