import { NextResponse } from "next/server";
import { syncDemoCatalog } from "@/lib/demo-catalog-sync";
import { adminEmailsFromEnv } from "@/lib/form-check-access";
import { cronSecret } from "@/lib/gymdesk/config";
import { timingSafeEqualString } from "@/lib/gymdesk/crypto";
import { normalizeEmail } from "@/lib/auth";
import { getCurrentUser } from "@/lib/session";

export const runtime = "nodejs";

/**
 * Refresh the shared strength and bag catalogs in place.
 *
 * Does not delete workout sessions or draft sets.
 * A day number that left the catalog and still has a logged session is kept.
 * Day numbers that are still in the catalog are rewritten in place, including
 * form-video trims. Safe to call more than once.
 *
 * Authorize with either:
 * - `Authorization: Bearer $CRON_SECRET` (or `?secret=$CRON_SECRET`)
 * - a signed-in admin, or an email listed in `ADMIN_EMAILS`
 *
 * Production (replace the host):
 *   curl -X POST "https://<host>/api/admin/reseed-catalog" \
 *     -H "Authorization: Bearer $CRON_SECRET"
 *
 * The next Training or Calendar read also runs this once per server process,
 * so a deploy picks the v2 days up without a manual call. Use this route when
 * you want the JSON result (days updated, days kept because they have logs).
 */
async function authorized(request: Request) {
  const url = new URL(request.url);
  const provided =
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
    url.searchParams.get("secret") ||
    "";
  const expected = cronSecret();
  if (expected && provided && timingSafeEqualString(provided, expected)) return true;
  const user = await getCurrentUser();
  if (!user) return false;
  if (user.role === "admin") return true;
  return adminEmailsFromEnv().includes(normalizeEmail(user.email));
}

async function handle(request: Request) {
  if (!(await authorized(request))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const result = await syncDemoCatalog();
  return NextResponse.json(result);
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
