import { extendActiveSession } from "@/lib/session";

/** Slide the login cookie forward. Route handlers may set cookies; pages may not. */
export async function POST() {
  await extendActiveSession();
  return Response.json({ ok: true });
}
