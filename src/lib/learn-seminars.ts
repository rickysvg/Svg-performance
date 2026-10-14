import { z } from "zod";
import raw from "@/content/learn-seminars.json";
import {
  type LockedSeminarTeaser,
  type SeminarPlaybackModel,
} from "@/lib/seminar-playback";

export const SEMINAR_CATEGORIES = [
  { id: "mma", label: "MMA" },
  { id: "boxing", label: "Boxing" },
  { id: "muay-thai", label: "Muay Thai" },
  { id: "wrestling", label: "Wrestling" },
  { id: "bjj", label: "BJJ" },
  { id: "judo", label: "Judo" },
  { id: "fight-iq", label: "Fight IQ" },
  { id: "sc", label: "S&C" },
] as const;

export type SeminarCategory = (typeof SEMINAR_CATEGORIES)[number]["id"];

const CATEGORY_IDS = SEMINAR_CATEGORIES.map((category) => category.id) as [
  SeminarCategory,
  ...SeminarCategory[],
];

const TimestampSource = z.enum(["youtube_chapters", "description", "transcript"]);
const SeminarLevel = z.enum(["beginner", "intermediate", "advanced"]);

export const SeminarClip = z.object({
  id: z.string(),
  videoId: z.string().length(11),
  title: z.string(),
  technique: z.string(),
  startSeconds: z.number().int().nonnegative(),
  endSeconds: z.number().int().positive().nullable(),
  notes: z.string(),
  timestampSource: TimestampSource,
  watchUrl: z.url(),
  embedUrl: z.url(),
});

export const Seminar = z.object({
  slug: z.string(),
  videoId: z.string().length(11),
  url: z.url(),
  embedUrl: z.url(),
  thumbnailUrl: z.url(),
  displayTitle: z.string(),
  youtubeTitle: z.string(),
  channel: z.string(),
  channelId: z.string(),
  channelUrl: z.url(),
  source: z.enum(["bangtao", "other"]),
  priority: z.boolean(),
  featured: z.boolean(),
  category: z.enum(CATEGORY_IDS),
  categoryLabel: z.string(),
  tags: z.array(z.string()),
  level: SeminarLevel,
  requiredFeature: z.enum(["learn_beginner", "learn_full"]),
  instructors: z
    .array(
      z.object({
        name: z.string(),
        credential: z.string(),
        credentialSource: z.url(),
        credentialSourceType: z.enum([
          "wikipedia",
          "official_site",
          "video_title_or_description",
        ]),
        credentialSourceAlt: z.url().optional(),
      }),
    )
    .min(1),
  credentialLine: z.string(),
  durationSeconds: z.number().int().positive(),
  duration: z.string(),
  uploadDate: z.string(),
  engagement: z.object({
    views: z.number().nullable(),
    likes: z.number().nullable(),
    comments: z.number().nullable(),
    checkedAt: z.string(),
  }),
  notes: z
    .array(z.object({ text: z.string(), source: z.enum(["description", "summary"]) }))
    .min(3)
    .max(6),
  chaptersSource: z.enum(["youtube_chapters", "description"]).nullable(),
  chapters: z.array(
    z.object({
      startSeconds: z.number().int(),
      endSeconds: z.number().int(),
      label: z.string(),
      timestamp: z.string(),
      source: z.enum(["youtube_chapters", "description"]).nullable(),
    }),
  ),
  clipsStatus: z.enum(["verified", "pending_transcript", "not_needed"]),
  clips: z.array(SeminarClip),
  verification: z.object({
    checkedAt: z.string(),
    method: z.string(),
    availability: z.string(),
    playableInEmbed: z.boolean(),
    oembedStatus: z.number().nullable().optional(),
  }),
});

export type Seminar = z.infer<typeof Seminar>;
export type SeminarClip = z.infer<typeof SeminarClip>;
export type SeminarLevel = z.infer<typeof SeminarLevel>;

export const SEMINARS: Seminar[] = z
  .object({ seminars: z.array(Seminar) })
  .parse(raw).seminars;

const seminarBySlug = new Map(SEMINARS.map((seminar) => [seminar.slug, seminar]));

export type SeminarLevelFilter = "all" | SeminarLevel;
export type SeminarView = "seminars" | "clips";
export type LearnHubTab = "seminars" | "library";

export type SeminarFilters = {
  category?: SeminarCategory | "all";
  level?: SeminarLevelFilter;
  q?: string;
  cage?: boolean;
};

export type SeminarClipListItem = {
  id: string;
  technique: string;
  notes: string;
  startSeconds: number;
  slug: string;
  displayTitle: string;
  thumbnailUrl: string;
  instructorNames: string;
  credentialLine: string;
  categoryLabel: string;
  level: SeminarLevel;
  clipCount: number;
};

export function seminarCategoryLabel(category: string) {
  return SEMINAR_CATEGORIES.find((item) => item.id === category)?.label ?? category;
}

export function seminarLevelLabel(level: string) {
  if (level === "beginner") return "Beginner";
  if (level === "intermediate") return "Intermediate";
  if (level === "advanced") return "Advanced";
  return level;
}

/** Unknown or missing categories resolve to all. */
export function resolveSeminarCategory(value: string | undefined): SeminarCategory | "all" {
  if (!value || value === "all") return "all";
  return SEMINAR_CATEGORIES.some((category) => category.id === value)
    ? (value as SeminarCategory)
    : "all";
}

export function resolveSeminarLevel(value: string | undefined): SeminarLevelFilter {
  if (value === "beginner" || value === "intermediate" || value === "advanced") return value;
  return "all";
}

export function resolveSeminarView(value: string | undefined): SeminarView {
  return value === "clips" ? "clips" : "seminars";
}

export function resolveLearnTab(value: string | undefined): LearnHubTab {
  return value === "library" ? "library" : "seminars";
}

export function resolveSeminarCage(value: string | undefined, category: SeminarCategory | "all") {
  if (category !== "mma") return false;
  return value === "1" || value === "true";
}

export function buildLearnHubHref(query: {
  tab?: LearnHubTab;
  q?: string;
  cat?: string;
  level?: string;
  view?: SeminarView;
  cage?: boolean;
  topic?: string;
}) {
  const params = new URLSearchParams();
  if (query.tab === "library") {
    params.set("tab", "library");
    if (query.q?.trim()) params.set("q", query.q.trim());
    if (query.topic && query.topic !== "all") params.set("topic", query.topic);
    if (query.level) params.set("level", query.level);
  } else {
    if (query.q?.trim()) params.set("q", query.q.trim());
    if (query.cat && query.cat !== "all") params.set("cat", query.cat);
    if (query.level && query.level !== "all") params.set("level", query.level);
    if (query.view === "clips") params.set("view", "clips");
    if (query.cage && query.cat === "mma") params.set("cage", "1");
  }
  const search = params.toString();
  return search ? `/learn?${search}` : "/learn";
}

function needle(q: string | undefined) {
  return q?.trim().toLowerCase() ?? "";
}

function seminarIdentityHaystack(seminar: Seminar) {
  return [
    seminar.displayTitle,
    seminar.youtubeTitle,
    seminar.credentialLine,
    ...seminar.instructors.map((instructor) => instructor.name),
    ...seminar.tags,
    ...seminar.notes.map((note) => note.text),
  ]
    .join("\n")
    .toLowerCase();
}

export function seminarMatchesQuery(seminar: Seminar, q: string | undefined) {
  const term = needle(q);
  if (!term) return true;
  const haystack = [
    seminarIdentityHaystack(seminar),
    ...seminar.clips.map((clip) => `${clip.technique}\n${clip.notes}\n${clip.title}`),
  ]
    .join("\n")
    .toLowerCase();
  return haystack.includes(term);
}

function clipMatchesQuery(clip: SeminarClip, term: string) {
  return `${clip.technique}\n${clip.notes}\n${clip.title}`.toLowerCase().includes(term);
}

function sortSeminars(seminars: Seminar[]) {
  return [...seminars].sort((a, b) => {
    if (a.priority !== b.priority) return a.priority ? -1 : 1;
    return (b.engagement.views ?? 0) - (a.engagement.views ?? 0);
  });
}

export function listSeminars(filters: SeminarFilters = {}) {
  const category = !filters.category || filters.category === "all" ? undefined : filters.category;
  const level = !filters.level || filters.level === "all" ? undefined : filters.level;
  const term = needle(filters.q);
  return sortSeminars(
    SEMINARS.filter((seminar) => {
      if (category && seminar.category !== category) return false;
      if (level && seminar.level !== level) return false;
      if (filters.cage && !seminar.tags.includes("cage-wall")) return false;
      if (term && !seminarMatchesQuery(seminar, term)) return false;
      return true;
    }),
  );
}

export function listFeaturedSeminars() {
  return sortSeminars(SEMINARS.filter((seminar) => seminar.featured));
}

export function instructorNames(seminar: Pick<Seminar, "instructors">) {
  return seminar.instructors.map((instructor) => instructor.name).join(" & ");
}

export function listClips(filters: SeminarFilters = {}): SeminarClipListItem[] {
  const term = needle(filters.q);
  const parents = listSeminars({ ...filters, q: undefined });
  const items: SeminarClipListItem[] = [];
  for (const seminar of parents) {
    const parentHit = term ? seminarIdentityHaystack(seminar).includes(term) : false;
    for (const clip of seminar.clips) {
      if (term && !parentHit && !clipMatchesQuery(clip, term)) continue;
      items.push({
        id: clip.id,
        technique: clip.technique,
        notes: clip.notes,
        startSeconds: clip.startSeconds,
        slug: seminar.slug,
        displayTitle: seminar.displayTitle,
        thumbnailUrl: seminar.thumbnailUrl,
        instructorNames: instructorNames(seminar),
        credentialLine: seminar.credentialLine,
        categoryLabel: seminar.categoryLabel,
        level: seminar.level,
        clipCount: seminar.clips.length,
      });
    }
  }
  return items;
}

export function seminarForSlug(slug: string) {
  return seminarBySlug.get(slug) ?? null;
}

export function clipById(seminar: Seminar, clipId: string | undefined | null) {
  if (!clipId) return null;
  return seminar.clips.find((clip) => clip.id === clipId) ?? null;
}

/** Integer seconds in range. Anything else, including oversized values, is ignored. */
export function resolveSeminarTime(durationSeconds: number, t: string | undefined | null) {
  if (t == null || t === "") return null;
  if (!/^\d+$/.test(t)) return null;
  const seconds = Number(t);
  if (seconds < 0 || seconds > durationSeconds) return null;
  return seconds;
}

/** Beginner seminars stay open without the full library. Clips use the parent. */
export function seminarLocked(seminar: Pick<Seminar, "level">, opts: { fullLibrary: boolean }) {
  return !opts.fullLibrary && seminar.level !== "beginner";
}

export function seminarPlaybackModel(seminar: Seminar): SeminarPlaybackModel {
  return {
    slug: seminar.slug,
    videoId: seminar.videoId,
    displayTitle: seminar.displayTitle,
    url: seminar.url,
    embedUrl: seminar.embedUrl,
    thumbnailUrl: seminar.thumbnailUrl,
    durationSeconds: seminar.durationSeconds,
    clips: seminar.clips.map((clip) => ({
      id: clip.id,
      technique: clip.technique,
      notes: clip.notes,
      startSeconds: clip.startSeconds,
      endSeconds: clip.endSeconds,
      watchUrl: clip.watchUrl,
      embedUrl: clip.embedUrl,
    })),
    chapters: seminar.chapters.map((chapter) => ({
      startSeconds: chapter.startSeconds,
      endSeconds: chapter.endSeconds,
      label: chapter.label,
      timestamp: chapter.timestamp,
    })),
  };
}

export function lockedSeminarTeaser(seminar: Seminar): LockedSeminarTeaser {
  return {
    slug: seminar.slug,
    displayTitle: seminar.displayTitle,
    thumbnailUrl: seminar.thumbnailUrl,
    channel: seminar.channel,
    channelUrl: seminar.channelUrl,
    categoryLabel: seminar.categoryLabel,
    levelLabel: seminarLevelLabel(seminar.level),
    duration: seminar.duration,
    instructors: seminar.instructors.map((instructor) => ({
      name: instructor.name,
      credential: instructor.credential,
      credentialSource: instructor.credentialSource,
    })),
    notes: seminar.notes.map((note) => note.text),
    techniques: seminar.clips.map((clip) => clip.technique),
    clipsStatus: seminar.clipsStatus,
  };
}

export type SeminarDetailAccess =
  | {
      locked: true;
      teaser: LockedSeminarTeaser;
      playback: null;
    }
  | {
      locked: false;
      teaser: null;
      playback: SeminarPlaybackModel;
      initialClipId: string | null;
      initialSeconds: number | null;
      watchUrl: string;
    };

/**
 * Locked viewers get a teaser with technique names only.
 * Clip embed URLs stay off that object so they never enter the RSC payload.
 */
export function seminarDetailAccess(
  seminar: Seminar,
  opts: { fullLibrary: boolean; clipId?: string; t?: string },
): SeminarDetailAccess {
  if (seminarLocked(seminar, opts)) {
    return { locked: true, teaser: lockedSeminarTeaser(seminar), playback: null };
  }
  const clip = clipById(seminar, opts.clipId);
  const initialSeconds = clip ? null : resolveSeminarTime(seminar.durationSeconds, opts.t);
  return {
    locked: false,
    teaser: null,
    playback: seminarPlaybackModel(seminar),
    initialClipId: clip?.id ?? null,
    initialSeconds,
    watchUrl: clip?.watchUrl ?? seminar.url,
  };
}

export function learnSeminarIssues() {
  const issues: string[] = [];
  const slugs = new Set<string>();
  const clipIds = new Set<string>();
  let cageWall = false;

  for (const seminar of SEMINARS) {
    if (slugs.has(seminar.slug)) issues.push(`duplicate slug ${seminar.slug}`);
    slugs.add(seminar.slug);
    if (seminar.tags.includes("cage-wall")) cageWall = true;

    const expectedFeature = seminar.level === "beginner" ? "learn_beginner" : "learn_full";
    if (seminar.requiredFeature !== expectedFeature) {
      issues.push(`${seminar.slug} requiredFeature does not match level`);
    }
    if (!CATEGORY_IDS.includes(seminar.category)) {
      issues.push(`${seminar.slug} category`);
    }
    for (const field of ["url", "embedUrl", "thumbnailUrl"] as const) {
      if (!seminar[field].includes(seminar.videoId)) {
        issues.push(`${seminar.slug} ${field} missing videoId`);
      }
    }
    for (const instructor of seminar.instructors) {
      if (!instructor.credential.trim()) issues.push(`${seminar.slug} empty credential`);
      if (!/^https?:\/\//.test(instructor.credentialSource)) {
        issues.push(`${seminar.slug} credential source`);
      }
    }
    if (seminar.notes.length < 3 || seminar.notes.length > 6) {
      issues.push(`${seminar.slug} notes length`);
    }

    let previousStart = -1;
    const chapterStarts = new Set<number>();
    for (const chapter of seminar.chapters) {
      if (chapter.startSeconds < previousStart) {
        issues.push(`${seminar.slug} chapters unsorted`);
      }
      previousStart = chapter.startSeconds;
      chapterStarts.add(chapter.startSeconds);
      if (chapter.endSeconds > seminar.durationSeconds) {
        issues.push(`${seminar.slug} chapter end past duration`);
      }
    }

    if (seminar.clipsStatus === "verified" && seminar.clips.length === 0) {
      issues.push(`${seminar.slug} verified without clips`);
    }
    if (seminar.clipsStatus === "pending_transcript" && seminar.clips.length !== 0) {
      issues.push(`${seminar.slug} pending transcript has clips`);
    }

    for (const clip of seminar.clips) {
      if (clipIds.has(clip.id)) issues.push(`duplicate clip ${clip.id}`);
      clipIds.add(clip.id);
      if (!clip.id.startsWith(`${seminar.slug}--`)) {
        issues.push(`${clip.id} id prefix`);
      }
      if (clip.videoId !== seminar.videoId) issues.push(`${clip.id} videoId`);
      const end = clip.endSeconds;
      if (
        clip.startSeconds < 0 ||
        end == null ||
        clip.startSeconds >= end ||
        end > seminar.durationSeconds
      ) {
        issues.push(`${clip.id} range`);
      }
      if (
        (clip.timestampSource === "youtube_chapters" || clip.timestampSource === "description") &&
        !chapterStarts.has(clip.startSeconds)
      ) {
        issues.push(`${clip.id} start not in chapters`);
      }
      if (!clip.watchUrl.includes(`t=${clip.startSeconds}s`)) {
        issues.push(`${clip.id} watchUrl`);
      }
      if (!clip.embedUrl.includes(`start=${clip.startSeconds}`)) {
        issues.push(`${clip.id} embed start`);
      }
      if (end != null && !clip.embedUrl.includes(`end=${end}`)) {
        issues.push(`${clip.id} embed end`);
      }
    }
  }

  if (!cageWall) issues.push("missing cage-wall tag");
  return issues;
}
