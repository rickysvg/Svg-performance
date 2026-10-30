import {
  academyTag,
  normalizeFirstName,
  normalizeWaitlistEmail,
  readMailchimpConfig,
  subscribeToAudience,
  waitlistMessage,
  type WaitlistResponse,
  type WaitlistState,
} from "@/lib/drop-waitlist";
import { takeWaitlistSlot, waitlistClientKey } from "@/lib/drop-waitlist-rate";

export const runtime = "nodejs";

function json(state: WaitlistState, status: number) {
  const body: WaitlistResponse = { state, message: waitlistMessage(state) };
  return Response.json(body, { status });
}

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return json("invalid", 400);
  }
  const record = payload as {
    email?: unknown;
    firstName?: unknown;
    academyMember?: unknown;
    consent?: unknown;
  };
  const email = normalizeWaitlistEmail(record.email);
  const firstName = normalizeFirstName(record.firstName);
  const tag = academyTag(record.academyMember);
  if (!email || firstName == null) return json("invalid", 400);
  if (!tag) {
    return Response.json(
      {
        state: "invalid",
        message: "Choose whether you are an SVG Academy member.",
      } satisfies WaitlistResponse,
      { status: 400 },
    );
  }
  if (record.consent !== true) return json("consent", 400);

  const now = Date.now();
  const ipOk = takeWaitlistSlot(waitlistClientKey(request), now, 10 * 60 * 1000, 5);
  const emailOk = takeWaitlistSlot(`email:${email}`, now, 10 * 60 * 1000, 3);
  if (!ipOk || !emailOk) return json("rate", 429);

  const config = readMailchimpConfig();
  if (!config) return json("unconfigured", 200);

  const state = await subscribeToAudience({ config, email, firstName, tag });
  const status = state === "pending" || state === "exists" ? 200 : 502;
  return json(state, status);
}
