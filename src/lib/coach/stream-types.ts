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
  coachingStyle?: string;
  coachName?: string;
};

export type FallbackReason =
  | "no_key"
  | "http_401"
  | "http_403"
  | "http_404"
  | "http_429"
  | "http_4xx"
  | "http_5xx"
  | "network"
  | "timeout"
  | "empty";

export type CoachStreamEvent =
  | {
      type: "meta";
      threadId?: string;
      messageId?: string;
      exerciseName?: string;
      offline: boolean;
      refused: boolean;
      fallbackReason?: FallbackReason;
    }
  | { type: "delta"; text: string }
  | {
      type: "done";
      content: string;
      offline: boolean;
      refused: boolean;
      fallbackReason?: FallbackReason;
    }
  | { type: "error"; message: string };
