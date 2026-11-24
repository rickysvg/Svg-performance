import { handleRevenueCatWebhook } from "@/lib/revenuecat";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return handleRevenueCatWebhook(request);
}
