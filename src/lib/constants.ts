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
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
] as const;

export const GOAL_OPTIONS = [
  { value: "stronger-for-class", label: "Get stronger for class" },
  { value: "conditioning", label: "Improve conditioning" },
  { value: "build-muscle", label: "Build muscle" },
  { value: "more-athletic", label: "Feel more athletic" },
  { value: "stay-consistent", label: "Stay consistent between classes" },
  { value: "other", label: "Something else" },
] as const;

export const FOCUS_OPTIONS = [
  { value: "mma", label: "MMA" },
  { value: "muay-thai", label: "Muay Thai" },
  { value: "boxing", label: "Boxing" },
  { value: "wrestling", label: "Wrestling" },
  { value: "jiu-jitsu", label: "Jiu-Jitsu" },
  { value: "cagework", label: "Cagework" },
  { value: "general-fitness", label: "General fitness" },
] as const;

export const GOAL_PROMPTS = GOAL_OPTIONS.map((goal) => goal.label);

export const SESSION_LENGTH_OPTIONS = [
  { value: 30, label: "30 min" },
  { value: 45, label: "45 min" },
  { value: 60, label: "60 min" },
] as const;

export const TRAINING_LOCATION_OPTIONS = [
  { value: "gym", label: "Gym" },
  { value: "home", label: "Home" },
  { value: "both", label: "Both" },
] as const;

export const COMPETITION_STATUS_OPTIONS = [
  { value: "none", label: "Not competing" },
  { value: "amateur", label: "Amateur" },
  { value: "pro", label: "Pro" },
] as const;

export const COACHING_TONE_OPTIONS = [
  { value: "tough", label: "More tough" },
  { value: "balanced", label: "Balanced" },
  { value: "encouraging", label: "More encouraging" },
] as const;

export const OBSTACLE_OPTIONS = [
  { value: "consistency", label: "Consistency" },
  { value: "nutrition", label: "Nutrition" },
  { value: "technique", label: "Technique" },
  { value: "recovery", label: "Recovery" },
  { value: "time", label: "Time" },
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
  "/paths",
  "/journal",
  "/report",
];
