import { NextResponse } from "next/server";
import { handleGymdeskWebhook } from "@/lib/gymdesk/webhook";

function clientIp(request: Request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

async function handle(request: Request, event: string) {
  try {
    return await handleGymdeskWebhook({
      event,
      request,
      clientIp: clientIp(request),
    });
  } catch {
    return NextResponse.json({ ok: true });
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ event: string }> },
) {
  const { event } = await context.params;
  return handle(request, event);
}

export async function GET(
  request: Request,
  context: { params: Promise<{ event: string }> },
) {
  const { event } = await context.params;
  return handle(request, event);
}
