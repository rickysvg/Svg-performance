import { NextResponse } from "next/server";
import {
  gymdeskWebhookSecret,
  isGymdeskEvent,
  isGymdeskSyncEnabled,
} from "@/lib/gymdesk/config";
import { timingSafeEqualString } from "@/lib/gymdesk/crypto";
import { assertGymdeskRateLimit } from "@/lib/gymdesk/rate-limit";
import { setSyncMeta, upsertRosterFromWebhook } from "@/lib/gymdesk/roster";

function pick(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return "";
}

export function parseGymdeskPayload(
  body: Record<string, unknown>,
  query: URLSearchParams,
): { gymdeskId: string; name: string; email: string; phone: string } {
  const merged: Record<string, unknown> = { ...body };
  for (const [key, value] of query.entries()) {
    if (key === "t") continue;
    if (merged[key] == null || merged[key] === "") merged[key] = value;
  }
  return {
    gymdeskId: pick(merged, ["member_id", "memberId", "id", "Member ID"]),
    name: pick(merged, ["name", "Name"]),
    email: pick(merged, ["email", "Email"]),
    phone: pick(merged, ["phone", "Phone"]),
  };
}

export async function parseRequestBody(request: Request): Promise<Record<string, unknown>> {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const json = await request.json().catch(() => ({}));
    return json && typeof json === "object" ? (json as Record<string, unknown>) : {};
  }
  if (
    contentType.includes("application/x-www-form-urlencoded") ||
    contentType.includes("multipart/form-data")
  ) {
    const form = await request.formData().catch(() => null);
    const record: Record<string, unknown> = {};
    if (form) {
      for (const [key, value] of form.entries()) {
        record[key] = typeof value === "string" ? value : "";
      }
    }
    return record;
  }
  const text = await request.text().catch(() => "");
  if (!text) return {};
  try {
    const json = JSON.parse(text) as unknown;
    return json && typeof json === "object" ? (json as Record<string, unknown>) : {};
  } catch {
    const params = new URLSearchParams(text);
    const record: Record<string, unknown> = {};
    for (const [key, value] of params.entries()) record[key] = value;
    return record;
  }
}

export async function handleGymdeskWebhook(input: {
  event: string;
  request: Request;
  clientIp: string;
}) {
  if (!isGymdeskEvent(input.event)) {
    return NextResponse.json({ error: "unknown_event" }, { status: 404 });
  }
  if (!isGymdeskSyncEnabled()) {
    return NextResponse.json({ ok: true, disabled: true });
  }
  const url = new URL(input.request.url);
  const provided = url.searchParams.get("t") ?? "";
  if (!timingSafeEqualString(provided, gymdeskWebhookSecret())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    await assertGymdeskRateLimit({
      scope: "webhook-ip",
      value: input.clientIp || "unknown",
      windowMs: 60_000,
      max: 60,
      message: "Too many webhook calls.",
    });
  } catch {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const body = input.request.method === "GET" ? {} : await parseRequestBody(input.request);
  const payload = parseGymdeskPayload(body, url.searchParams);
  if (!payload.gymdeskId) {
    return NextResponse.json({ ok: true, ignored: "missing_member_id" });
  }

  await upsertRosterFromWebhook({
    event: input.event,
    gymdeskId: payload.gymdeskId,
    name: payload.name,
    email: payload.email,
    phone: payload.phone,
  });
  await setSyncMeta(`webhook:${input.event}`, payload.gymdeskId);
  return NextResponse.json({ ok: true });
}
