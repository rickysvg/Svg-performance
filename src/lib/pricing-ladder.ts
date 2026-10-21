import { COACHING_MONTHLY, PERFORMANCE_ANNUAL, PERFORMANCE_MONTHLY, usd } from "@/lib/pricing";
import { VIP_INTRO_CENTS } from "@/lib/vip-coaching";

/** Comparison chart. Voice and read-aloud stay off this ladder. */
export const PRICING_LADDER_COLUMNS = [
  {
    id: "academy",
    label: "Academy member",
    prices: ["With dues"],
  },
  {
    id: "pro",
    label: "SVG Pro",
    prices: [`${usd(PERFORMANCE_MONTHLY)}/mo`, `or ${usd(PERFORMANCE_ANNUAL)}/yr`],
  },
  {
    id: "vip",
    label: "VIP Coaching",
    prices: [
      `${usd(COACHING_MONTHLY)}/mo`,
      `${usd(VIP_INTRO_CENTS / 100)} first month`,
      "for SVG academy members",
    ],
  },
] as const;

export type LadderColumnId = (typeof PRICING_LADDER_COLUMNS)[number]["id"];

export type LadderCell = {
  /** Included, or not part of this column. */
  mark: "yes" | "no";
  /** Replaces the bare check when the column's version of the row is specific. */
  note?: string;
  /** This column is where the row starts, or where the offer changes. */
  adds?: boolean;
};

export type LadderRow = {
  id: string;
  label: string;
  cells: Record<LadderColumnId, LadderCell>;
};

const yes: LadderCell = { mark: "yes" };
const no: LadderCell = { mark: "no" };
const add: LadderCell = { mark: "yes", adds: true };

export const PRICING_LADDER_ROWS: readonly LadderRow[] = [
  { id: "workouts", label: "Workouts & program", cells: { academy: yes, pro: yes, vip: yes } },
  { id: "logger", label: "Logger / timers", cells: { academy: yes, pro: yes, vip: yes } },
  {
    id: "ai_chat",
    label: "AI coach chat (text)",
    cells: { academy: no, pro: add, vip: yes },
  },
  {
    id: "checkins",
    label: "Check-ins with AI feedback",
    cells: { academy: no, pro: add, vip: yes },
  },
  {
    id: "form_checks",
    label: "Form checks",
    cells: {
      academy: no,
      pro: { mark: "yes", note: "AI/self", adds: true },
      vip: { mark: "yes", note: "Timestamped notes from Ricky", adds: true },
    },
  },
  {
    id: "program",
    label: "Program written by Ricky",
    cells: { academy: no, pro: no, vip: add },
  },
  {
    id: "camp",
    label: "Fight-camp plan",
    cells: { academy: no, pro: no, vip: add },
  },
  {
    id: "weekly",
    label: "Weekly plan adjustments",
    cells: { academy: no, pro: no, vip: add },
  },
  {
    id: "messages",
    label: "Direct messages with Ricky (48h replies)",
    cells: { academy: no, pro: no, vip: add },
  },
  {
    id: "assessment",
    label: "Monthly assessment",
    cells: { academy: no, pro: no, vip: add },
  },
  { id: "priority", label: "Priority", cells: { academy: no, pro: no, vip: add } },
];
