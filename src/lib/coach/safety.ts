export type SafetyRefusal = {
  code:
    | "pain"
    | "medical"
    | "weight_cut"
    | "cross_account"
    | "shame"
    | "exhaustion";
  message: string;
};

const PAIN =
  /\b(concussion|knocked out|blacked out|chest pain|can'?t breathe|broken bone|sharp pain|pain that worries|dizzy after a hit|vomiting after a hit|numb(ness)? in (my )?(arm|leg))\b/i;

const MEDICAL =
  /\b(diagnos(e|is)|what (med|medicine|pill)|steroids?|trt\b|hormone dos|sarms?|insulin|prescribe|blood work said)\b/i;

const CUT_TOOLS =
  /\b(sauna suits?|sweat suits?|garbage bags?|diuretics?|laxatives?|spit(?:ting)?(?: out)? water|no water for|water[- ]loads?(?:ing)?)\b/i;

const CUT_HOWTO =
  /\b(how (?:do|can|should) i|write me|give me|help me|walk me through|make me a|build me|step by step|protocols?)\b/i;

const CUT_METHODS =
  /\b(dehydrat\w*|rapid cuts?|water cuts?|cut water|sweat(?:ing)? (?:off|out)|saunas?)\b/i;

const CUT_GOAL =
  /\b(cut|weigh-?ins?|make weight|pounds?|lbs?)\b/i;

/** Educational questions about risk or sauna-for-recovery. Not a how-to. */
const CUT_EDUCATIONAL =
  /\b(why|what makes|dangerous|danger|risks?|ok for recovery|okay for recovery|for recovery)\b/i;

/**
 * Protocol requests only. "Why are water cuts dangerous?" and
 * "Is sauna ok for recovery?" stay answerable. Suits, diuretics,
 * water loads, and how-to dehydration still refuse.
 */
export function isWeightCutProtocol(text: string) {
  if (CUT_TOOLS.test(text)) return true;
  const howto = CUT_HOWTO.test(text);
  const method = CUT_METHODS.test(text);
  if (howto && method) return true;
  if (/\bwater cuts?\b/i.test(text) && /\b\d+\s*(?:lb|lbs|pounds?)\b/i.test(text)) return true;
  if (
    /\b(?:can|could|should) i\b/i.test(text) &&
    method &&
    CUT_GOAL.test(text) &&
    !CUT_EDUCATIONAL.test(text)
  ) {
    return true;
  }
  return false;
}

const CROSS_ACCOUNT =
  /\b(another member|other member|someone else'?s (log|workout|food|profile)|user [a-z0-9-]{6,}|show me .+@.+ workout|their (private )?(records|workouts|food log))\b/i;

const SHAME =
  /\b(you('re| are) lazy|fat shame|call me fat|make me feel like garbage)\b/i;

const EXHAUSTION =
  /\b(train through (the )?pain|push through (this )?injury|keep going if i'?m exhausted|ignore the headache)\b/i;

export function detectSafetyRefusal(
  message: string,
  options?: { currentUserId?: string; mentionedUserId?: string },
): SafetyRefusal | null {
  const text = message.trim();
  if (options?.mentionedUserId && options.currentUserId) {
    if (options.mentionedUserId !== options.currentUserId) {
      return {
        code: "cross_account",
        message:
          "I only use the signed-in member's own records. I will not open another person's log. Ask that teammate or a coach on the floor.",
      };
    }
  }
  if (CROSS_ACCOUNT.test(text)) {
    return {
      code: "cross_account",
      message:
        "I only use the signed-in member's own records. I will not open another person's log. Ask that teammate or a coach on the floor.",
    };
  }
  if (isWeightCutProtocol(text)) {
    return {
      code: "weight_cut",
      message:
        "I will not give an independent rapid weight-cut, sauna, diuretic, or dehydration plan. Fight-camp cuts need a coach and, when needed, a clinician. Show up hydrated and talk to staff in person.",
    };
  }
  if (PAIN.test(text) || EXHAUSTION.test(text)) {
    return {
      code: "pain",
      message:
        "Stop. I will not talk you through pain, a possible concussion, chest symptoms, or grinding while exhausted. Get a coach or medical help. Training can wait.",
    };
  }
  if (MEDICAL.test(text)) {
    return {
      code: "medical",
      message:
        "I cannot diagnose, prescribe, or advise on medicines or hormones. That is outside this chat. Talk to a licensed clinician and your coach.",
    };
  }
  if (SHAME.test(text)) {
    return {
      code: "shame",
      message:
        "I will not shame you. We can talk about the next honest session, not tearing you down.",
    };
  }
  return null;
}

/** Log the code only. Do not log the member's message. */
export function logCoachRefusal(input: {
  code: SafetyRefusal["code"];
  userId?: string;
  surface: "chat" | "stream" | "note";
}) {
  console.warn("[coach] safety refusal", {
    code: input.code,
    surface: input.surface,
    ...(input.userId ? { userId: input.userId } : {}),
  });
}

export function safetyPreamble() {
  return [
    "You are SVG Coach, a text assistant inspired by SVG MMA Academy coaching principles (Sacrifice, Vision, Greatness).",
    "You are the SVG AI coach. Do not claim a human wrote this reply. You are not a live coach and not medical advice.",
    "Be direct, disciplined, encouraging, and practical. Match the member's experience level when it is provided.",
    "Stay inside the selected topic lane when one is provided.",
    "Never pressure through pain, concussion symptoms, a headache after a hit, exhaustion, or dangerous dehydration.",
    "No medical diagnosis, medications, PEDs, hormone dosing, extreme restriction, or shame.",
    "No dehydration, sauna-suit, diuretic, laxative, spitting, or water-loading protocols, and no times or temperatures for sweating weight off.",
    "You may explain why water cuts and dehydration are dangerous. You may say a short sauna is optional for recovery only when the person replaces fluid, feels well, and is not cutting weight.",
    "Do not prescribe unsupervised sparring, live blasting, or fight-camp medical cuts.",
    "YouTube and Learn videos are external technique references, never SVG-produced film.",
    "Only use the current member's permitted records. Refuse cross-account requests.",
    "Use the approved notes when they apply and cite the file name. For general combat-sports, strength, nutrition, or rules knowledge, answer from expertise even if the notes don't cover it.",
    "Only say you don't know for gym-specific facts (schedule, prices, house rules, staff) or anything still marked TODO in COACHING_GUIDE.md. Then offer a coach handoff.",
  ].join(" ");
}
