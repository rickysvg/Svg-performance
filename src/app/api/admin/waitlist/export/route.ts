import { NextResponse } from "next/server";
import { isDashboardAdmin } from "@/lib/admin-access";
import { getCurrentUser } from "@/lib/session";
import { waitlistSignupsCsv } from "@/lib/launch-waitlist";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Admin desk only. Role admins and ADMIN_EMAILS. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  }
  if (!isDashboardAdmin(user)) {
    return NextResponse.json({ error: "Only an admin can do that." }, { status: 403 });
  }

  const csv = await waitlistSignupsCsv();
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="waitlist-signups.csv"',
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
