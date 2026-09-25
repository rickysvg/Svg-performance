export const STREAM_STOPPED_MARKER =
  "\n\n[Stopped — this reply was cut off.]";

export const STREAM_FAIL_COPY =
  "SVG Coach could not finish that reply. Check your connection and try again.";

export type CoachStreamKind = "chat" | "note";

export type CoachStreamRequest = {
  kind?: CoachStreamKind;
  message?: string;
  topic?: string;
  art?: string;
  mentionedUserId?: string;
  exerciseName?: string;
  programDayId?: string;
  logMode?: string;
  plannedLine?: string;
  experienceLevel?: string;
  coachingTone?: string;
};

export type CoachStreamEvent =
  | {
      type: "meta";
      threadId?: string;
      messageId?: string;
      exerciseName?: string;
      offline: boolean;
      refused: boolean;
    }
  | { type: "delta"; text: string }
  | { type: "done"; content: string; offline: boolean; refused: boolean }
  | { type: "error"; message: string };
