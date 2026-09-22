import { canUseFeature } from "@/lib/entitlements";

export type DailyQuote = {
  id: string;
  text: string;
  attribution: string;
};

/** Curated SVG / discipline / encouragement lines. No shame, no medical claims. */
export const DAILY_QUOTES: DailyQuote[] = [
  {
    id: "show-up",
    text: "Show up. Do the honest work. Leave a little in the tank for tomorrow.",
    attribution: "SVG Performance",
  },
  {
    id: "standard",
    text: "Raise the standard, not the volume. Clean reps beat sloppy hero sets.",
    attribution: "SVG Performance",
  },
  {
    id: "floor",
    text: "The floor does not care how you feel. It cares that you arrived.",
    attribution: "SVG Performance",
  },
  {
    id: "consistency",
    text: "Consistency is the skill. One finished session beats a perfect plan you skip.",
    attribution: "SVG Performance",
  },
  {
    id: "next-round",
    text: "You do not have to win the week. Win the next round you can control.",
    attribution: "SVG Performance",
  },
  {
    id: "discipline",
    text: "Discipline is doing the small thing when nobody is watching.",
    attribution: "SVG Performance",
  },
  {
    id: "breath",
    text: "Breathe. Reset your stance. Then take the next honest step.",
    attribution: "SVG Performance",
  },
  {
    id: "patience",
    text: "Patience is not softness. It is staying in the work long enough to get good.",
    attribution: "SVG Performance",
  },
  {
    id: "missed",
    text: "A missed day is information, not a verdict. Pick the next date and go.",
    attribution: "SVG Performance",
  },
  {
    id: "control",
    text: "Control what you can: sleep, water, the session in front of you.",
    attribution: "SVG Performance",
  },
  {
    id: "respect",
    text: "Respect the craft. Technique first, then load.",
    attribution: "SVG Performance",
  },
  {
    id: "quiet",
    text: "Quiet work stacks. Nobody claps for the third session of the week — do it anyway.",
    attribution: "SVG Performance",
  },
  {
    id: "partner",
    text: "Be a good partner: on time, honest effort, clean taps, clean words.",
    attribution: "SVG Performance",
  },
  {
    id: "fuel",
    text: "Fuel like you train — enough to work, not a punishment.",
    attribution: "SVG Performance",
  },
  {
    id: "eyes",
    text: "Live eyes on the floor beat a perfect note in your phone.",
    attribution: "SVG Performance",
  },
  {
    id: "finish",
    text: "Finish the session you started. Then stop. That is enough for today.",
    attribution: "SVG Performance",
  },
  {
    id: "humble",
    text: "Stay humble enough to drill basics. Stay proud enough to keep drilling.",
    attribution: "SVG Performance",
  },
  {
    id: "recover",
    text: "Recovery is part of the program. Sleep is not optional homework.",
    attribution: "SVG Performance",
  },
  {
    id: "clock",
    text: "The clock is the coach you cannot argue with. Work until it says rest.",
    attribution: "SVG Performance",
  },
  {
    id: "courage",
    text: "Courage is walking into the gym when the last session was ugly.",
    attribution: "SVG Performance",
  },
  {
    id: "details",
    text: "Details win fights. Details also win Tuesday.",
    attribution: "SVG Performance",
  },
];

export function quoteForLocalDate(now = new Date()): DailyQuote {
  const key = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return DAILY_QUOTES[hash % DAILY_QUOTES.length] ?? DAILY_QUOTES[0];
}

export async function getDailyQuoteCard(userId: string, now = new Date()) {
  const quote = quoteForLocalDate(now);
  const unlocked = await canUseFeature(userId, "daily_quote");
  return {
    quote,
    unlocked,
    teaser: teaserFromQuote(quote),
  };
}

export function teaserFromQuote(quote: DailyQuote) {
  const words = quote.text.split(" ");
  const snippet = words.slice(0, 6).join(" ");
  return `${snippet}…`;
}
