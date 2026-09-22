import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCurrentUser } from "@/lib/session";
import { completePolarOAuth, isPolarConfigured, polarOAuthCookieName, verifyPolarOAuthState } from "@/lib/polar";

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login?next=/heart", origin));
  }
  if (!isPolarConfigured()) {
    return NextResponse.redirect(new URL("/heart?polar=not-configured", origin));
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code") ?? "";
  const state = url.searchParams.get("state") ?? "";
  const jar = await cookies();
  const cookieState = jar.get(polarOAuthCookieName())?.value ?? "";
  jar.delete(polarOAuthCookieName());

  if (!code || !verifyPolarOAuthState(state) || state !== cookieState) {
    return NextResponse.redirect(new URL("/heart?polar=error", origin));
  }

  try {
    await completePolarOAuth(user.id, code);
    return NextResponse.redirect(new URL("/heart?polar=connected", origin));
  } catch {
    return NextResponse.redirect(new URL("/heart?polar=error", origin));
  }
}
