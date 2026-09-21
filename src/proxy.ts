import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/constants";

const PROTECTED = [
  "/home",
  "/training",
  "/progress",
  "/profile",
  "/nutrition",
  "/learn",
  "/coach",
  "/admin",
  "/staff",
  "/shop",
];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProtected = PROTECTED.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
  if (!isProtected) {
    return NextResponse.next();
  }
  if (!request.cookies.get(SESSION_COOKIE)?.value) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/home/:path*",
    "/training/:path*",
    "/progress/:path*",
    "/profile/:path*",
    "/nutrition/:path*",
    "/learn/:path*",
    "/coach/:path*",
    "/admin/:path*",
    "/staff/:path*",
    "/shop/:path*",
    "/home",
    "/training",
    "/progress",
    "/profile",
    "/nutrition",
    "/learn",
    "/coach",
    "/admin",
    "/staff",
    "/shop",
  ],
};
