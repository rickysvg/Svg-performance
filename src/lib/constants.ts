export const SESSION_COOKIE = "svg_session";
export const SESSION_DAYS = 30;

/** Sampled from the neon V in the attached SVG MMA Academy logo. */
export const BRAND_ACCENT = "#CFFF00";

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
];
