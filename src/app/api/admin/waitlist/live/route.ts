import { NextResponse } from "next/server";
import { requireWaitlistLiveAdmin } from "@/lib/waitlist-live-access";
import { runWaitlistLiveEmail } from "@/lib/waitlist-live-run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const NO_STORE = { "Cache-Control": "private, no-store" };

function textField(value: unknown) {
  return typeof value === "string" ? value : null;
}

async function readInput(request: Request) {
  const url = new URL(request.url);
  let record: Record<string, unknown> = {};
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const raw = await request.text();
    if (raw.trim()) {
      try {
        const parsed = JSON.parse(raw) as unknown;
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          return { error: "Send a JSON object." as const };
        }
        record = parsed as Record<string, unknown>;
      } catch {
        return { error: "Send a JSON object." as const };
      }
    }
  }
  return {
    confirm: textField(record.confirm) ?? url.searchParams.get("confirm"),
    to: textField(record.to) ?? url.searchParams.get("to"),
    firstName: textField(record.firstName) ?? url.searchParams.get("firstName"),
  };
}

function denied(status: 401 | 403, error: string) {
  return NextResponse.json({ error }, { status, headers: NO_STORE });
}

/** Dry run only. A confirm query on GET does not send. */
export async function GET(request: Request) {
  const gate = await requireWaitlistLiveAdmin();
  if (!gate.ok) return denied(gate.status, gate.error);
  // Confirm on this URL is ignored. GET never sends.
  void new URL(request.url).searchParams.get("confirm");
  const result = await runWaitlistLiveEmail({});
  return NextResponse.json(result, { headers: NO_STORE });
}

/**
 * Default: dry run (recipient count and preview).
 * POST confirm=send to mail one batch. POST confirm=test with `to` for one address.
 */
export async function POST(request: Request) {
  const gate = await requireWaitlistLiveAdmin();
  if (!gate.ok) return denied(gate.status, gate.error);
  const input = await readInput(request);
  if ("error" in input) {
    return NextResponse.json({ ok: false, error: input.error }, { status: 400, headers: NO_STORE });
  }
  const result = await runWaitlistLiveEmail(input);
  return NextResponse.json(result, { status: result.ok ? 200 : 400, headers: NO_STORE });
}
