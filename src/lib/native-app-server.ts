import { headers } from "next/headers";
import { nativePlatformFromUserAgent, storeBillingBlocksWebCheckout } from "@/lib/native-app";

/** True when the request comes from the SVG Performance store app web view. */
export async function storeAppBlocksWebBilling(): Promise<boolean> {
  const incoming = await headers();
  return storeBillingBlocksWebCheckout(nativePlatformFromUserAgent(incoming.get("user-agent")));
}
