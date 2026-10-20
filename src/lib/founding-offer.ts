import { countFoundingSeats } from "@/lib/billing";
import { foundingOfferFromCount } from "@/lib/pricing";

export type FoundingOffer = {
  enrolled: number;
  spotsLeft: number;
  line: string;
};

/**
 * Live founding line from active founding subscriptions.
 * Hidden once 40 seats are taken, and hidden if the count cannot be read.
 */
export async function loadFoundingOffer(): Promise<FoundingOffer | null> {
  try {
    const enrolled = await countFoundingSeats();
    return foundingOfferFromCount(enrolled);
  } catch {
    return null;
  }
}
