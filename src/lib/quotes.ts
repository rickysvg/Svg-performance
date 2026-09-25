import { canUseFeature } from "@/lib/entitlements";
import { timeZoneForUser } from "@/lib/profile";
import { APP_TIMEZONE, dayKey } from "@/lib/timezone";

export type QuoteSource = "ufc" | "achiever" | "scripture";

export type DailyQuote = {
  id: string;
  text: string;
  attribution: string;
  source: QuoteSource;
};

/**
 * Daily quote bank: UFC legends, well-known high achievers, and short Bible verses.
 * Even mix. Widely known lines only — no invented attributions.
 */
export const DAILY_QUOTES: DailyQuote[] = [
  {
    id: "mcgregor-precision",
    source: "ufc",
    text: "Precision beats power, and timing beats speed.",
    attribution: "Conor McGregor, UFC champion",
  },
  {
    id: "jordan-failed",
    source: "achiever",
    text: "I've failed over and over and over again in my life. And that is why I succeed.",
    attribution: "Michael Jordan",
  },
  {
    id: "phil-4-13",
    source: "scripture",
    text: "I can do all things through Christ who strengthens me.",
    attribution: "Philippians 4:13",
  },
  {
    id: "mcgregor-obsession",
    source: "ufc",
    text: "There's no talent here, this is hard work. This is an obsession.",
    attribution: "Conor McGregor, UFC champion",
  },
  {
    id: "jordan-make-it",
    source: "achiever",
    text: "Some people want it to happen, some wish it would happen, others make it happen.",
    attribution: "Michael Jordan",
  },
  {
    id: "josh-1-9",
    source: "scripture",
    text: "Be strong and courageous. Do not be afraid; do not be discouraged, for the Lord your God is with you wherever you go.",
    attribution: "Joshua 1:9",
  },
  {
    id: "mcgregor-doubt",
    source: "ufc",
    text: "Doubt is only removed by action.",
    attribution: "Conor McGregor, UFC champion",
  },
  {
    id: "kobe-give-up",
    source: "achiever",
    text: "The moment you give up is the moment you let someone else win.",
    attribution: "Kobe Bryant",
  },
  {
    id: "isa-40-31",
    source: "scripture",
    text: "Those who wait on the Lord shall renew their strength; they shall mount up with wings like eagles.",
    attribution: "Isaiah 40:31",
  },
  {
    id: "gsp-opponent",
    source: "ufc",
    text: "The biggest opponent I have to face is myself.",
    attribution: "Georges St-Pierre, UFC champion",
  },
  {
    id: "kobe-perseverance",
    source: "achiever",
    text: "Great things come from hard work and perseverance. No excuses.",
    attribution: "Kobe Bryant",
  },
  {
    id: "prov-12-24",
    source: "scripture",
    text: "The hand of the diligent will rule.",
    attribution: "Proverbs 12:24",
  },
  {
    id: "gsp-student",
    source: "ufc",
    text: "I'm a student of the game. I always want to learn more.",
    attribution: "Georges St-Pierre, UFC champion",
  },
  {
    id: "kobe-rise",
    source: "achiever",
    text: "Everything negative — pressure, challenges — is all an opportunity for me to rise.",
    attribution: "Kobe Bryant",
  },
  {
    id: "prov-13-4",
    source: "scripture",
    text: "The soul of the sluggard craves and gets nothing, while the soul of the diligent is richly supplied.",
    attribution: "Proverbs 13:4",
  },
  {
    id: "khabib-hard-work",
    source: "ufc",
    text: "Hard work. Dedication. That's my life.",
    attribution: "Khabib Nurmagomedov, UFC champion",
  },
  {
    id: "ali-days",
    source: "achiever",
    text: "Don't count the days; make the days count.",
    attribution: "Muhammad Ali",
  },
  {
    id: "prov-14-23",
    source: "scripture",
    text: "In all toil there is profit, but mere talk tends only to poverty.",
    attribution: "Proverbs 14:23",
  },
  {
    id: "khabib-work",
    source: "ufc",
    text: "I don't need to talk. I need to work.",
    attribution: "Khabib Nurmagomedov, UFC champion",
  },
  {
    id: "ali-training",
    source: "achiever",
    text: "I hated every minute of training, but I said, don't quit. Suffer now and live the rest of your life as a champion.",
    attribution: "Muhammad Ali",
  },
  {
    id: "1cor-9-24",
    source: "scripture",
    text: "Do you not know that in a race all the runners run, but only one receives the prize? Run in such a way that you may obtain it.",
    attribution: "1 Corinthians 9:24",
  },
  {
    id: "nunes-job",
    source: "ufc",
    text: "I don't care who is in front of me. I go in there and do my job.",
    attribution: "Amanda Nunes, UFC champion",
  },
  {
    id: "ali-courage",
    source: "achiever",
    text: "He who is not courageous enough to take risks will accomplish nothing in life.",
    attribution: "Muhammad Ali",
  },
  {
    id: "1cor-9-27",
    source: "scripture",
    text: "I discipline my body and keep it under control.",
    attribution: "1 Corinthians 9:27",
  },
  {
    id: "fedor-stand",
    source: "ufc",
    text: "The one who doesn't fall never stands up.",
    attribution: "Fedor Emelianenko, heavyweight legend",
  },
  {
    id: "goggins-conversations",
    source: "achiever",
    text: "The most important conversations you'll ever have are the ones you'll have with yourself.",
    attribution: "David Goggins",
  },
  {
    id: "2tim-1-7",
    source: "scripture",
    text: "For God gave us a spirit not of fear but of power and love and self-control.",
    attribution: "2 Timothy 1:7",
  },
  {
    id: "gracie-black-belt",
    source: "ufc",
    text: "A black belt is a white belt who never quit.",
    attribution: "Royce Gracie, UFC pioneer",
  },
  {
    id: "goggins-calluses",
    source: "achiever",
    text: "You have to build calluses on your brain just like you build calluses on your hands.",
    attribution: "David Goggins",
  },
  {
    id: "heb-12-1",
    source: "scripture",
    text: "Let us run with endurance the race that is set before us.",
    attribution: "Hebrews 12:1",
  },
  {
    id: "jones-failure",
    source: "ufc",
    text: "Don't be afraid of failure. This is the way to succeed.",
    attribution: "Jon Jones, UFC champion",
  },
  {
    id: "jocko-discipline",
    source: "achiever",
    text: "Discipline equals freedom.",
    attribution: "Jocko Willink",
  },
  {
    id: "gal-6-9",
    source: "scripture",
    text: "Let us not grow weary of doing good, for in due season we will reap, if we do not give up.",
    attribution: "Galatians 6:9",
  },
  {
    id: "silva-train",
    source: "ufc",
    text: "I'm not a superhero. I just train hard and believe in what I do.",
    attribution: "Anderson Silva, UFC champion",
  },
  {
    id: "lombardi-dictionary",
    source: "achiever",
    text: "The only place success comes before work is in the dictionary.",
    attribution: "Vince Lombardi",
  },
  {
    id: "prov-21-5",
    source: "scripture",
    text: "The plans of the diligent lead surely to abundance.",
    attribution: "Proverbs 21:5",
  },
  {
    id: "couture-limits",
    source: "ufc",
    text: "The only limitations we have are those we place on ourselves.",
    attribution: "Randy Couture, UFC champion",
  },
  {
    id: "wooden-details",
    source: "achiever",
    text: "It's the little details that are vital. Little things make big things happen.",
    attribution: "John Wooden",
  },
  {
    id: "col-3-23",
    source: "scripture",
    text: "Whatever you do, work heartily, as for the Lord and not for men.",
    attribution: "Colossians 3:23",
  },
  {
    id: "stipe-regular",
    source: "ufc",
    text: "I'm just a regular guy who works hard.",
    attribution: "Stipe Miocic, UFC champion",
  },
  {
    id: "roosevelt-can",
    source: "achiever",
    text: "Do what you can, with what you have, where you are.",
    attribution: "Theodore Roosevelt",
  },
  {
    id: "ps-27-1",
    source: "scripture",
    text: "The Lord is my light and my salvation; whom shall I fear?",
    attribution: "Psalm 27:1",
  },
  {
    id: "holloway-blessed",
    source: "ufc",
    text: "Stay blessed and keep working.",
    attribution: "Max Holloway, UFC champion",
  },
  {
    id: "churchill-hell",
    source: "achiever",
    text: "If you're going through hell, keep going.",
    attribution: "Winston Churchill",
  },
  {
    id: "prov-24-16",
    source: "scripture",
    text: "For the righteous falls seven times and rises again.",
    attribution: "Proverbs 24:16",
  },
  {
    id: "holm-ready",
    source: "ufc",
    text: "I stay ready so I don't have to get ready.",
    attribution: "Holly Holm, UFC champion",
  },
  {
    id: "brady-far",
    source: "achiever",
    text: "I didn't come this far to only come this far.",
    attribution: "Tom Brady",
  },
  {
    id: "ps-144-1",
    source: "scripture",
    text: "Blessed be the Lord, my rock, who trains my hands for war, and my fingers for battle.",
    attribution: "Psalm 144:1",
  },
  {
    id: "johnson-humble",
    source: "ufc",
    text: "Stay humble. Stay hungry. Keep learning.",
    attribution: "Demetrious Johnson, UFC champion",
  },
  {
    id: "woods-better",
    source: "achiever",
    text: "No matter how good you get, you can always get better, and that's the exciting part.",
    attribution: "Tiger Woods",
  },
  {
    id: "rom-5-3",
    source: "scripture",
    text: "Suffering produces endurance, and endurance produces character.",
    attribution: "Romans 5:3–4",
  },
  {
    id: "shevchenko-secret",
    source: "ufc",
    text: "I work every single day. That is my secret.",
    attribution: "Valentina Shevchenko, UFC champion",
  },
  {
    id: "arnold-reps",
    source: "achiever",
    text: "The last three or four reps is what makes the muscle grow.",
    attribution: "Arnold Schwarzenegger",
  },
  {
    id: "james-1-12",
    source: "scripture",
    text: "Blessed is the man who remains steadfast under trial.",
    attribution: "James 1:12",
  },
  {
    id: "edgar-heart",
    source: "ufc",
    text: "Heart over everything.",
    attribution: "Frankie Edgar, UFC champion",
  },
  {
    id: "bruce-lee-kick",
    source: "achiever",
    text: "I fear not the man who has practiced 10,000 kicks once, but I fear the man who has practiced one kick 10,000 times.",
    attribution: "Bruce Lee",
  },
  {
    id: "1tim-4-8",
    source: "scripture",
    text: "Physical training is of some value, but godliness has value for all things.",
    attribution: "1 Timothy 4:8",
  },
  {
    id: "cain-hard-work",
    source: "ufc",
    text: "Hard work. That's all it is.",
    attribution: "Cain Velasquez, UFC champion",
  },
  {
    id: "dempsey-champion",
    source: "achiever",
    text: "A champion is someone who gets up when he can't.",
    attribution: "Jack Dempsey",
  },
  {
    id: "ps-18-32",
    source: "scripture",
    text: "It is God who arms me with strength and makes my way blameless.",
    attribution: "Psalm 18:32",
  },
];

export function quoteSourceCounts(quotes: DailyQuote[] = DAILY_QUOTES) {
  return quotes.reduce(
    (counts, quote) => {
      counts[quote.source] += 1;
      return counts;
    },
    { ufc: 0, achiever: 0, scripture: 0 },
  );
}

export function quoteForLocalDate(now = new Date(), timeZone = APP_TIMEZONE): DailyQuote {
  const key = dayKey(now, timeZone);
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return DAILY_QUOTES[hash % DAILY_QUOTES.length] ?? DAILY_QUOTES[0];
}

export async function getDailyQuoteCard(userId: string, now = new Date(), timeZone?: string) {
  const tz = timeZone ?? (await timeZoneForUser(userId));
  const quote = quoteForLocalDate(now, tz);
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
