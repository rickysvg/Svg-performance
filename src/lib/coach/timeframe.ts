/**
 * Dates a member names in a question, or a fight date already on file.
 * Month-only ("February") lands on the 1st, this year or next if that day has passed.
 */

const MONTHS: Array<{ name: string; index: number; aliases: string[] }> = [
  { name: "January", index: 0, aliases: ["january", "jan"] },
  { name: "February", index: 1, aliases: ["february", "feb"] },
  { name: "March", index: 2, aliases: ["march", "mar"] },
  { name: "April", index: 3, aliases: ["april", "apr"] },
  { name: "May", index: 4, aliases: ["may"] },
  { name: "June", index: 5, aliases: ["june", "jun"] },
  { name: "July", index: 6, aliases: ["july", "jul"] },
  { name: "August", index: 7, aliases: ["august", "aug"] },
  { name: "September", index: 8, aliases: ["september", "sept", "sep"] },
  { name: "October", index: 9, aliases: ["october", "oct"] },
  { name: "November", index: 10, aliases: ["november", "nov"] },
  { name: "December", index: 11, aliases: ["december", "dec"] },
];

export type MentionedWhen = {
  date: Date;
  label: string;
  source: "message" | "saved";
};

function utcNoon(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month, day, 12, 0, 0));
}

function utcDay(date: Date) {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

export function weeksUntil(target: Date, now: Date) {
  const days = Math.round((utcDay(target) - utcDay(now)) / 86_400_000);
  return Math.max(0, Math.round(days / 7));
}

function monthByAlias(alias: string) {
  const key = alias.toLowerCase();
  return MONTHS.find((month) => month.aliases.includes(key)) ?? null;
}

function rollForward(year: number, month: number, day: number, now: Date) {
  let date = utcNoon(year, month, day);
  if (utcDay(date) + 7 * 86_400_000 < utcDay(now)) {
    date = utcNoon(year + 1, month, day);
  }
  if (utcDay(date) < utcDay(now)) {
    date = utcNoon(date.getUTCFullYear() + 1, month, day);
  }
  return date;
}

type MonthHit = { index: number; name: string; day: number; year: number | null; at: number };

function monthHits(text: string): MonthHit[] {
  const hits: MonthHit[] = [];
  const re =
    /\b(january|february|march|april|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sept|sep|oct|nov|dec)\b(?:\s+(\d{1,2}))?(?:,?\s*(\d{4}))?/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text))) {
    const month = monthByAlias(match[1]);
    if (!month) continue;
    const day = match[2] ? Number(match[2]) : 1;
    if (day < 1 || day > 31) continue;
    hits.push({
      index: month.index,
      name: month.name,
      day,
      year: match[3] ? Number(match[3]) : null,
      at: match.index,
    });
  }
  const may = /\b(?:in|until|till|by|before|during)\s+may(?:\s+(\d{1,2}))?(?:,?\s*(\d{4}))?/gi;
  while ((match = may.exec(text))) {
    const day = match[1] ? Number(match[1]) : 1;
    hits.push({
      index: 4,
      name: "May",
      day,
      year: match[2] ? Number(match[2]) : null,
      at: match.index,
    });
  }
  return hits;
}

function preferredHit(text: string, hits: MonthHit[]) {
  if (hits.length === 0) return null;
  const until = /\b(?:until|till|by|before|in)\b/gi;
  let best = hits[0];
  let bestScore = -1;
  for (const hit of hits) {
    let score = 0;
    until.lastIndex = 0;
    let mark: RegExpExecArray | null;
    while ((mark = until.exec(text))) {
      const distance = hit.at - mark.index;
      if (distance >= 0 && distance < 24) score += 5;
    }
    if (score > bestScore) {
      best = hit;
      bestScore = score;
    }
  }
  return best;
}

function fromWeeksPhrase(text: string, now: Date): MentionedWhen | null {
  const named = /\b(?:in|for)\s+(\d{1,2})\s+weeks?\b/i.exec(text);
  const out = /\b(\d{1,2})\s+weeks?\s+(?:out|away|from now)\b/i.exec(text);
  const count = Number(named?.[1] ?? out?.[1]);
  if (!Number.isFinite(count) || count <= 0 || count > 60) return null;
  const date = new Date(utcDay(now) + count * 7 * 86_400_000);
  return { date, label: `${count} weeks`, source: "message" };
}

export function parseMentionedWhen(text: string, now: Date): MentionedWhen | null {
  const iso = /\b(\d{4})-(\d{2})-(\d{2})\b/.exec(text);
  if (iso) {
    const date = utcNoon(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    return { date, label: iso[0], source: "message" };
  }
  const hit = preferredHit(text, monthHits(text));
  if (hit) {
    const year = hit.year ?? now.getUTCFullYear();
    const date = rollForward(year, hit.index, hit.day, now);
    const cleanLabel = hit.day === 1 ? hit.name : `${hit.name} ${hit.day}`;
    return {
      date,
      label: hit.year ? `${cleanLabel}, ${date.getUTCFullYear()}` : cleanLabel,
      source: "message",
    };
  }
  return fromWeeksPhrase(text, now);
}

export function parseSavedFightDate(value: string | null | undefined, now: Date): MentionedWhen | null {
  if (!value) return null;
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (!iso) return null;
  const date = utcNoon(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  if (utcDay(date) < utcDay(now)) return null;
  return { date, label: iso[0], source: "saved" };
}

export function resolveWhen(
  message: string,
  now: Date,
  savedFightDate?: string | null,
): MentionedWhen | null {
  return parseMentionedWhen(message, now) ?? parseSavedFightDate(savedFightDate, now);
}

export type PhaseLine = { title: string; detail: string };

/** Base, specific prep, peak, and fight week, scaled to the weeks that are left. */
export function campPhasePlan(weeks: number): PhaseLine[] {
  if (weeks <= 1) {
    return [
      {
        title: "Fight week",
        detail: "Short and sharp. Keep a little speed. No new techniques and no hard sparring.",
      },
    ];
  }
  if (weeks <= 3) {
    const peak = Math.max(1, weeks - 1);
    return [
      {
        title: "Peak",
        detail: `${peak} week${peak === 1 ? "" : "s"} of less volume, keep the speed, and ease hard sparring.`,
      },
      {
        title: "Fight week",
        detail: "Last week. Short and sharp. Nothing new.",
      },
    ];
  }
  if (weeks <= 7) {
    const specific = Math.max(1, weeks - 3);
    return [
      {
        title: "Specific prep",
        detail: `First ${specific} week${specific === 1 ? "" : "s"}. Skill starts to look like the fight. Keep strength. Do not chase a new max.`,
      },
      {
        title: "Peak",
        detail: "Then 2 weeks. Less volume, keep speed, ease hard sparring.",
      },
      {
        title: "Fight week",
        detail: "Last week. Short and sharp. Nothing new.",
      },
    ];
  }
  const peak = Math.min(3, Math.max(2, Math.round(weeks * 0.15)));
  let specific = Math.min(6, Math.max(3, Math.round(weeks * 0.3)));
  let base = weeks - peak - specific - 1;
  if (base < 3) {
    const shift = 3 - base;
    specific = Math.max(2, specific - shift);
    base = weeks - peak - specific - 1;
  }
  const baseEnd = base;
  const specificEnd = base + specific;
  const peakEnd = specificEnd + peak;
  return [
    {
      title: "Base / strength",
      detail: `Weeks 1–${baseEnd}. Skill volume, lifts, and aerobic rounds you can repeat. Sparring stays technical.`,
    },
    {
      title: "Specific prep",
      detail: `Weeks ${baseEnd + 1}–${specificEnd}. The work starts to look like the fight. Conditioning matches the round length.`,
    },
    {
      title: "Peak",
      detail: `Weeks ${specificEnd + 1}–${peakEnd}. Less volume, keep speed, ease hard sparring. No new techniques.`,
    },
    {
      title: "Fight week",
      detail: `Week ${weeks}. Short and sharp. Nothing new.`,
    },
  ];
}
