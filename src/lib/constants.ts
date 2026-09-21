export const SESSION_COOKIE = "svg_session";
export const SESSION_DAYS = 30;

/** Sampled from the neon V and PERFORMANCE bar on the official SVG Performance logo. */
export const BRAND_ACCENT = "#D0FF00";

export const EQUIPMENT_OPTIONS = [
  "Bodyweight only",
  "Dumbbells",
  "Kettlebell",
  "Barbell / rack",
  "Resistance bands",
  "Pull-up bar",
  "Jump rope",
  "Bike or assault bike",
] as const;

export const WEEKDAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

export const EXPERIENCE_LEVELS = [
  { value: "beginner", label: "New to lifting" },
  { value: "intermediate", label: "Some lifting experience" },
  { value: "advanced", label: "Consistent lifter" },
] as const;

export const GOAL_PROMPTS = [
  "Get stronger for class",
  "Improve conditioning",
  "Build muscle",
  "Feel more athletic",
  "Stay consistent between classes",
] as const;

/** DEMO daily targets used until a member types their own. Estimates only. */
export const DEMO_NUTRITION_TARGETS = {
  calories: 2200,
  proteinG: 140,
  carbsG: 220,
  fatG: 70,
} as const;

export const MEMBER_ROUTES = [
  "/home",
  "/training",
  "/progress",
  "/profile",
  "/shop",
  "/nutrition",
  "/learn",
  "/coach",
  "/staff",
  "/book",
  "/plan",
];
