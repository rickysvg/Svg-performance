import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { readCheckInVideoForActor } from "@/lib/weekly-checkin";
import { ForbiddenError, NotFoundError } from "@/lib/errors";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ checkInId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  }
  const { checkInId } = await params;
  try {
    const { row, bytes } = await readCheckInVideoForActor(checkInId, user);
    return new NextResponse(Buffer.from(bytes), {
      status: 200,
      headers: {
        "Content-Type": row.videoMimeType || "video/mp4",
        "Content-Length": String(bytes.byteLength),
        "Cache-Control": "private, no-store",
        "Content-Disposition": "inline",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Could not open that clip." }, { status: 400 });
  }
}
