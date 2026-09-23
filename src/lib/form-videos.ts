/**
 * Curated YouTube form-reference catalog for the DEMO strength + skill programs.
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
  "Jab–cross (1–2)": {
    url: "https://www.youtube.com/watch?v=vyTaKpylOcU",
    pending: false,
    channel: "Tony Jeffries",
    title: "How to Throw a 1 - 2 / Jab - Cross in Boxing",
  },
  "Low kick (roundhouse)": {
    url: "https://www.youtube.com/watch?v=J9dK0uIEXIM",
    pending: false,
    channel: "Paul Banasiak @MuayThaiTechnician",
    title: "Muay Thai Kick LIKE A PRO! step-by-step guide",
  },
  "Hands to low-kick combo": {
    url: "https://www.youtube.com/watch?v=J9dK0uIEXIM",
    pending: false,
    channel: "Paul Banasiak @MuayThaiTechnician",
    title: "Muay Thai Kick LIKE A PRO! step-by-step guide",
  },
  "Teep (push kick)": {
    url: "https://www.youtube.com/watch?v=2nTKWDvZptk",
    pending: false,
    channel: "Kingdom Martial Arts Academy",
    title: "Learn the Muay Thai Teep in 11 minutes! Step-by-Step Tutorial for ALL Levels!",
  },
  "Double-collar clinch posture": {
    url: "https://www.youtube.com/watch?v=_hEKmkZQttU",
    pending: false,
    channel: "Muay Thai Clinch Technique",
    title: "How To Turn Your Opponent To Land A Knee",
  },
  "Straight knee (clinch)": {
    url: "https://www.youtube.com/watch?v=xsymld6rm24",
    pending: false,
    channel: "Master A / Warrior Collective",
    title: "Muay Thai How to Develop Devastating Knees Tutorial",
  },
  "Alternate knee rhythm": {
    url: "https://www.youtube.com/watch?v=xsymld6rm24",
    pending: false,
    channel: "Master A / Warrior Collective",
    title: "Muay Thai How to Develop Devastating Knees Tutorial",
  },
  "Exit the clinch / frame": {
    url: "https://www.youtube.com/watch?v=_hEKmkZQttU",
    pending: false,
    channel: "Muay Thai Clinch Technique",
    title: "How To Turn Your Opponent To Land A Knee",
  },
  "Boxing jab": {
    url: "https://www.youtube.com/watch?v=Z0a_XVJDV-g",
    pending: false,
    channel: "eBoxing Academy",
    title: "Beginner Boxing Tutorial: 6 Ways to Throw the Jab",
  },
  "Lead hook": {
    url: "https://www.youtube.com/watch?v=UFVDcNDnpoU",
    pending: false,
    channel: "Tony Jeffries / Sanabul",
    title: "Boxing Basics with Tony Jeffries: How to throw a hook punch",
  },
  "1-2-3 bag rounds": {
    url: "https://www.youtube.com/watch?v=UFVDcNDnpoU",
    pending: false,
    channel: "Tony Jeffries / Sanabul",
    title: "Boxing Basics with Tony Jeffries: How to throw a hook punch",
  },
  "Mount / high-posture hold": {
    url: "https://www.youtube.com/watch?v=Y4uFk8kS7Lw",
    pending: false,
    channel: "Coach Firas Zahabi",
    title: "MMA Ground and Pound Tutorial",
  },
  "Short punch from mount": {
    url: "https://www.youtube.com/watch?v=Y4uFk8kS7Lw",
    pending: false,
    channel: "Coach Firas Zahabi",
    title: "MMA Ground and Pound Tutorial",
  },
  "Hip drive + post": {
    url: "https://www.youtube.com/watch?v=Y4uFk8kS7Lw",
    pending: false,
    channel: "Coach Firas Zahabi",
    title: "MMA Ground and Pound Tutorial",
  },
  "Ground-and-pound burst": {
    url: "https://www.youtube.com/watch?v=Y4uFk8kS7Lw",
    pending: false,
    channel: "Coach Firas Zahabi",
    title: "MMA Ground and Pound Tutorial",
  },
  "Level change (penetration step)": {
    url: "https://www.youtube.com/watch?v=KhEdji8BuQ0",
    pending: false,
    channel: "TeachMeGrappling Coach Brian",
    title: "How to PROPERLY Finish the DOUBLE LEG! (Drill)",
  },
  "Double-leg entry": {
    url: "https://www.youtube.com/watch?v=KhEdji8BuQ0",
    pending: false,
    channel: "TeachMeGrappling Coach Brian",
    title: "How to PROPERLY Finish the DOUBLE LEG! (Drill)",
  },
  "Sprawl": {
    url: "https://www.youtube.com/watch?v=NmqVOswRpW4",
    pending: false,
    channel: "Chess Club Jiu-Jitsu",
    title: "BJJ Beginners Tutorial - How to Sprawl",
  },
  "Shot–sprawl reset": {
    url: "https://www.youtube.com/watch?v=J0kcsLXX1Ms",
    pending: false,
    channel: "Ben Askren / BJJ Fanatics",
    title: "Wrestling Moves - Sprawl by Ben Askren",
  },
  "Closed guard posture break": {
    url: "https://www.youtube.com/watch?v=KKxD5kdOkk0",
    pending: false,
    channel: "Stephan Kesting",
    title: "BJJ Closed Guard Principles",
  },
  "Hip escape (shrimp)": {
    url: "https://www.youtube.com/watch?v=TQ4gJ7E6Xis",
    pending: false,
    channel: "Stephan Kesting",
    title: "10 Ways to Shrimp and Improve Hip Mobility on the Ground",
  },
  "Closed guard hip tilt": {
    url: "https://www.youtube.com/watch?v=KKxD5kdOkk0",
    pending: false,
    channel: "Stephan Kesting",
    title: "BJJ Closed Guard Principles",
  },
  "Frame and recover": {
    url: "https://www.youtube.com/watch?v=GLqJOhLn_PQ",
    pending: false,
    channel: "Chess Club Jiu-Jitsu",
    title: "BJJ Beginners Tutorial - Side Control Escape to Closed Guard",
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
