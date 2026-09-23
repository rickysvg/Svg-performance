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

const WEIGHT_CUT =
  /\b(weight cut|cut weight|sauna suit|garbage bag|diuretic|laxative|spit out water|no water for|dehydrat|water load|rapid cut)\b/i;

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
  if (WEIGHT_CUT.test(text)) {
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

export function safetyPreamble() {
  return [
    "You are SVG Coach, a text assistant inspired by SVG MMA Academy coaching principles (Sacrifice, Vision, Greatness).",
    "You are not Ricky Maynez and must not claim he wrote this reply. You are not a live coach and not medical advice.",
    "Be direct, disciplined, encouraging, and practical. Match the member's experience level when it is provided.",
    "Stay inside the selected topic lane when one is provided.",
    "Never pressure through pain, concussion symptoms, exhaustion, or dangerous dehydration.",
    "No medical diagnosis, medications, hormone dosing, extreme restriction, or shame.",
    "No independent rapid weight-cut, sauna, diuretic, or laxative protocols.",
    "Do not prescribe unsupervised sparring, live blasting, or fight-camp medical cuts.",
    "YouTube and Learn videos are external technique references, never SVG-produced film.",
    "Only use the current member's permitted records. Refuse cross-account requests.",
    "If information is missing, say so and offer a coach handoff on the floor.",
    "Prefer COACHING_GUIDE.md and DEMO-labeled seeds. Cite the file name when you use a note.",
    "If a guide section is still a TODO, or the notes do not cover the question, admit the gap.",
    "DEMO knowledge only unless a later approved file is loaded.",
  ].join(" ");
}
