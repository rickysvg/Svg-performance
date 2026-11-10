import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { getLatestSubscription } from "@/lib/access";
import { normalizePlanId } from "@/lib/plans";
import { subscriptionBlocksCheckout } from "@/lib/subscription-access";
import { getVipPricingPhase } from "@/lib/vip-store";

export default async function VipIndexPage() {
  const user = await requireUser();
  const subscription = await getLatestSubscription(user.id);
  if (
    subscription &&
    normalizePlanId(subscription.plan) === "coaching" &&
    subscriptionBlocksCheckout(subscription.status)
  ) {
    redirect("/plan");
  }
  const phase = await getVipPricingPhase(user.id);
  if (phase === "member") redirect("/plan");
  if (phase === "checkout") redirect("/vip/checkout");
  redirect("/vip/apply");
}
