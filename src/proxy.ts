import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/constants";
import { PATH_HEADER } from "@/lib/locked-paths";

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
  "/book",
  "/plan",
  "/paths",
  "/journal",
  "/report",
  "/heart",
  "/fight-camp",
  "/form-check",
];

const PUBLIC_FILE = /\.(webp|png|jpe?g|gif|svg|ico|mp4|webm|woff2?)$/i;

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (PUBLIC_FILE.test(pathname)) {
    return NextResponse.next();
  }
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
  // Member layout reads the path to decide what stays open after a nonmember trial ends.
  const headers = new Headers(request.headers);
  headers.set(PATH_HEADER, pathname);
  return NextResponse.next({ request: { headers } });
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
    "/book/:path*",
    "/plan/:path*",
    "/paths/:path*",
    "/journal/:path*",
    "/report/:path*",
    "/heart/:path*",
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
    "/book",
    "/plan",
    "/paths",
    "/journal",
    "/report",
    "/heart",
    "/fight-camp/:path*",
    "/form-check/:path*",
    "/fight-camp",
    "/form-check",
  ],
};
