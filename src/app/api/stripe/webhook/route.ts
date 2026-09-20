import { NextResponse } from "next/server";
import { applyStripeEvent } from "@/lib/billing";
import { constructStripeEvent } from "@/lib/stripe";

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });
  }
  const payload = await request.text();
  try {
    const event = constructStripeEvent(payload, signature);
    await applyStripeEvent({
      type: event.type,
      data: { object: event.data.object as never },
    });
    return NextResponse.json({ received: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
