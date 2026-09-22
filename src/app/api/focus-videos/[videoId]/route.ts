import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { getFocusVideoForMember, readFocusVideoFile } from "@/lib/focus-videos";
import { NotFoundError } from "@/lib/errors";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ videoId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  }
  const access = await getFocusVideoForMember(user.id);
  if (!access.unlocked) {
    return NextResponse.json({ error: "Performance+ required." }, { status: 403 });
  }
  const { videoId } = await params;
  try {
    const { row, bytes } = await readFocusVideoFile(videoId);
    return new NextResponse(Buffer.from(bytes), {
      status: 200,
      headers: {
        "Content-Type": row.mimeType || "video/mp4",
        "Content-Length": String(row.byteSize),
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Could not open that video." }, { status: 400 });
  }
}
