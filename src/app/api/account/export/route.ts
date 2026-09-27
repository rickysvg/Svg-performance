import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { getProfileForUser, timeZoneForUser } from "@/lib/profile";
import {
  accountExportFilename,
  exportAccountDataForUser,
} from "@/lib/account-data";
import { AppError, AuthError } from "@/lib/errors";

export async function GET() {
  const user = await getCurrentUser();
  try {
    const payload = await exportAccountDataForUser(user);
    const profile = user ? await getProfileForUser(user.id) : null;
    const timeZone = user ? await timeZoneForUser(user.id, profile?.timeZone ?? null) : "UTC";
    const body = JSON.stringify(payload, null, 2);
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${accountExportFilename(new Date(), timeZone)}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Could not export your data." }, { status: 400 });
  }
}
