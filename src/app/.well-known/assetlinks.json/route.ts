import { NextResponse } from "next/server";
import { androidAssetLinks } from "@/lib/native-app";

// Android App Links for the store app. 404 until ANDROID_SHA256_CERT_FINGERPRINTS
// (upload key + Play App Signing key, comma-separated) is set in Vercel.
export function GET() {
  const body = androidAssetLinks(process.env.ANDROID_SHA256_CERT_FINGERPRINTS);
  if (!body) return new NextResponse("Not found", { status: 404 });
  return NextResponse.json(body, { headers: { "Cache-Control": "public, max-age=3600" } });
}
