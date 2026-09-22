import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { readTrainingClipFileForActor } from "@/lib/clips";
import { ForbiddenError, NotFoundError } from "@/lib/errors";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ clipId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  }
  const { clipId } = await params;
  try {
    const { row, bytes } = await readTrainingClipFileForActor(clipId, user);
    return new NextResponse(Buffer.from(bytes), {
      status: 200,
      headers: {
        "Content-Type": row.mimeType,
        "Content-Length": String(row.byteSize),
        "Cache-Control": "private, no-store",
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
