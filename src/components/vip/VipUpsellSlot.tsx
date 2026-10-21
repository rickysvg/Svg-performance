import { presentVipUpsell } from "@/lib/vip-store";
import { VipUpsellCard } from "@/components/vip/VipUpsellCard";

async function loadVipUpsell(userId: string) {
  try {
    return await presentVipUpsell(userId);
  } catch (error) {
    console.error("[vip-upsell]", error);
    return null;
  }
}

export async function VipUpsellSlot({ userId }: { userId: string }) {
  const card = await loadVipUpsell(userId);
  if (!card) return null;
  return <VipUpsellCard card={card} />;
}
