import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCurrentUser } from "@/lib/session";
import {
  buildPolarAuthorizeUrl,
  createPolarOAuthState,
  isPolarConfigured,
  polarOAuthCookieName,
} from "@/lib/polar";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  const origin = new URL(request.url).origin;
  if (!user) {
    return NextResponse.redirect(new URL("/login?next=/heart", origin));
  }
  if (!isPolarConfigured()) {
    return NextResponse.redirect(new URL("/heart?polar=not-configured", origin));
  }
  const state = createPolarOAuthState();
  const jar = await cookies();
  jar.set(polarOAuthCookieName(), state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  });
  return NextResponse.redirect(buildPolarAuthorizeUrl(state));
}
