/**
 * Curated YouTube form-reference catalog for the DEMO program.
 * These are external education links, not SVG-produced coaching videos.
 */

export type FormVideoSeed = {
  url: string;
  pending: boolean;
  channel: string;
  title: string;
};

export const DEMO_FORM_VIDEOS: Record<string, FormVideoSeed> = {
  "Goblet squat": {
    url: "https://www.youtube.com/watch?v=nfX7IFK9UNI",
    pending: false,
    channel: "National Academy of Sports Medicine (NASM)",
    title: "How to do a Goblet Squat | Proper Form & Technique",
  },
  "Romanian deadlift": {
    url: "https://www.youtube.com/watch?v=_oyxCn2iSjU",
    pending: false,
    channel: "Jeff Nippard",
    title: "HOW TO DO ROMANIAN DEADLIFTS (RDLs): Perfect Technique",
  },
  "Reverse lunge": {
    url: "https://www.youtube.com/watch?v=71VE3ssaJuQ",
    pending: false,
    channel: "ATHLEAN-X",
    title: "How To ACTUALLY Do Lunges (Feat. The “Rock”)",
  },
  "Squat jump or box step-up": {
    url: "https://www.youtube.com/watch?v=tZSYZdtbONc",
    pending: false,
    channel: "National Academy of Sports Medicine (NASM)",
    title: "How to do a Squat Jump | Proper Form & Technique",
  },
  "Front plank": {
    url: "https://www.youtube.com/watch?v=kL_NJAkCQBg",
    pending: false,
    channel: "Calisthenicmovement",
    title: "Mastering the Plank - In Just 2 Minutes",
  },
  "Push-up or dumbbell bench press": {
    url: "https://www.youtube.com/watch?v=IODxDxX7oi4",
    pending: false,
    channel: "Calisthenicmovement",
    title: "The Perfect Push Up | Do it right!",
  },
  "One-arm row": {
    url: "https://www.youtube.com/watch?v=djKXLt7kv7Q",
    pending: false,
    channel: "Jeff Nippard",
    title: "How To Do Dumbbell Rows: Build a Thicker Back",
  },
  "Overhead press": {
    url: "https://www.youtube.com/watch?v=CnBmiBqp-AI",
    pending: false,
    channel: "Art of Manliness / Mark Rippetoe (Starting Strength)",
    title: "How to Overhead Press With Mark Rippetoe",
  },
  "Band pull-apart or face pull": {
    url: "https://www.youtube.com/watch?v=eIq5CB9JfKE",
    pending: false,
    channel: "ATHLEAN-X",
    title: "Stop Doing Face Pulls Like This! (SAVE A FRIEND)",
  },
  "Farmer carry": {
    url: "https://www.youtube.com/watch?v=lt17MdlsIq8",
    pending: false,
    channel: "BJ Gaddour",
    title: "HOW TO: Farmers Walk or Carry",
  },
  "Kettlebell swing or hip hinge": {
    url: "https://www.youtube.com/watch?v=m-S9H2XVvYg",
    pending: false,
    channel: "Mark Wildman",
    title: "Kettlebell 2 - 2hand swing",
  },
  "Chin-up, band-assist, or lat pulldown": {
    url: "https://www.youtube.com/watch?v=eGo4IYlbE5g",
    pending: false,
    channel: "Calisthenicmovement",
    title: "The Perfect Pull Up - Do it right!",
  },
  "Lateral bound or side step-over": {
    url: "",
    pending: true,
    channel: "",
    title: "",
  },
  "Jump rope or easy bike intervals": {
    url: "https://www.youtube.com/watch?v=FJmRQ5iTXKE",
    pending: false,
    channel: "Jump Rope Dudes",
    title: "How To Jump Rope - 6 Basic Steps",
  },
  "Side plank": {
    url: "https://www.youtube.com/watch?v=7Zat7RFY52Y",
    pending: false,
    channel: "MuscleWiki",
    title: "Simplified: Side Plank - Improve Form",
  },
};

export function formVideoFieldsFor(name: string): {
  formVideoUrl: string;
  formVideoPending: boolean;
} {
  const entry = DEMO_FORM_VIDEOS[name];
  if (!entry || entry.pending) {
    return { formVideoUrl: "", formVideoPending: true };
  }
  return { formVideoUrl: entry.url, formVideoPending: false };
}

export function isYoutubeFormUrl(url: string): boolean {
  return Boolean(youtubeVideoId(url));
}

export function youtubeVideoId(url: string): string | null {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "").toLowerCase();
    if (host !== "youtube.com" && host !== "m.youtube.com" && host !== "youtu.be") {
      return null;
    }
    if (parsed.pathname.includes("/shorts/")) {
      return null;
    }
    if (host === "youtu.be") {
      const id = parsed.pathname.replace(/^\//, "").split("/")[0] ?? "";
      return id.length > 0 ? id : null;
    }
    return parsed.searchParams.get("v");
  } catch {
    return null;
  }
}

export function youtubeThumbSrcs(url: string): string[] {
  const id = youtubeVideoId(url);
  if (!id) return [];
  return [
    `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    `https://i.ytimg.com/vi/${id}/mqdefault.jpg`,
    `https://img.youtube.com/vi/${id}/hqdefault.jpg`,
  ];
}

export type FormVideoLookup = {
  url: string;
  pending: boolean;
};

export function lookupFormVideo(
  name: string,
  exercises?: Array<{ name: string; formVideoUrl: string; formVideoPending: boolean }>,
): FormVideoLookup {
  const fromDay = exercises?.find((row) => row.name === name);
  if (
    fromDay?.formVideoUrl &&
    !fromDay.formVideoPending &&
    isYoutubeFormUrl(fromDay.formVideoUrl)
  ) {
    return { url: fromDay.formVideoUrl, pending: false };
  }
  const seeded = formVideoFieldsFor(name);
  return { url: seeded.formVideoUrl, pending: seeded.formVideoPending };
}
