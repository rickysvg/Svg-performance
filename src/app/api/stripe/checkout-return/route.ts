import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/session";
import { getLatestSubscription } from "@/lib/access";
import { fulfillCheckoutReturnForUser } from "@/lib/checkout-return";

/** Syncs Checkout off the success page, then redirects. revalidatePath is legal here. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get("session_id") ?? "";
  const user = await getCurrentUser();
  const again = new URL("/api/stripe/checkout-return", url.origin);
  if (sessionId) again.searchParams.set("session_id", sessionId);
  if (!user) {
    const login = new URL("/login", url.origin);
    login.searchParams.set("next", `${again.pathname}${again.search}`);
    return NextResponse.redirect(login);
  }
  if (sessionId.startsWith("cs_")) {
    const existing = await getLatestSubscription(user.id);
    await fulfillCheckoutReturnForUser({
      userId: user.id,
      sessionId,
      knownCustomerId: existing?.stripeCustomerId || undefined,
    });
    revalidatePath("/plan");
    revalidatePath("/profile");
    revalidatePath("/home");
  }
  const dest = new URL("/billing/success", url.origin);
  if (sessionId) dest.searchParams.set("session_id", sessionId);
  dest.searchParams.set("synced", "1");
  return NextResponse.redirect(dest);
}
