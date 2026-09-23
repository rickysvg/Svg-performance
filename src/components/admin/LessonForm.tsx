"use client";

import { useActionState } from "react";
import { saveLessonAction, type LessonActionState } from "@/app/actions/lessons";
import { StatusBanner } from "@/components/StatusBanner";
import {
  LESSON_LEVELS,
  LESSON_LEVEL_LABELS,
  LESSON_TOPICS,
  LESSON_TOPIC_LABELS,
} from "@/lib/lessons";

type Lesson = {
  id?: string;
  slug: string;
  title: string;
  summary: string;
  skillLevel: string;
  topic: string;
  coachName: string;
  equipment: string;
  notes: string;
  technicalDescription: string;
  drills: string;
  keyDetails: string;
  youtubeUrl: string;
  videoPending: boolean;
  needsSupervision: boolean;
  supervisedNote: string;
  isDemo: boolean;
};

export function LessonForm({ lesson }: { lesson?: Lesson }) {
  const [state, action, pending] = useActionState(
    saveLessonAction,
    {} as LessonActionState,
  );
  return (
    <form action={action} className="space-y-3">
      <StatusBanner error={state.error} success={state.success} />
      {lesson?.id ? <input type="hidden" name="lessonId" value={lesson.id} /> : null}
      <input name="title" required defaultValue={lesson?.title} placeholder="Title" className="w-full rounded-xl border border-line bg-card px-3 py-3" />
      <input name="slug" defaultValue={lesson?.slug} placeholder="url-slug" className="w-full rounded-xl border border-line bg-card px-3 py-3" />
      <textarea name="summary" defaultValue={lesson?.summary} placeholder="Summary" rows={2} className="w-full rounded-xl border border-line bg-card px-3 py-3" />
      <select name="skillLevel" defaultValue={lesson?.skillLevel ?? "beginner"} className="w-full rounded-xl border border-line bg-card px-3 py-3">
        {LESSON_LEVELS.map((level) => (
          <option key={level} value={level}>
            {LESSON_LEVEL_LABELS[level]}
          </option>
        ))}
      </select>
      <select name="topic" defaultValue={lesson?.topic ?? "mma"} className="w-full rounded-xl border border-line bg-card px-3 py-3">
        {LESSON_TOPICS.map((topic) => (
          <option key={topic} value={topic}>
            {LESSON_TOPIC_LABELS[topic]}
          </option>
        ))}
      </select>
      <input name="coachName" defaultValue={lesson?.coachName ?? "SVG coaching staff"} className="w-full rounded-xl border border-line bg-card px-3 py-3" />
      <input name="equipment" defaultValue={lesson?.equipment} placeholder="Equipment" className="w-full rounded-xl border border-line bg-card px-3 py-3" />
      <textarea name="technicalDescription" defaultValue={lesson?.technicalDescription} placeholder="Technical description (mechanics, cues, common mistakes)" rows={5} className="w-full rounded-xl border border-line bg-card px-3 py-3" />
      <textarea name="notes" defaultValue={lesson?.notes} placeholder="Lesson notes" rows={4} className="w-full rounded-xl border border-line bg-card px-3 py-3" />
      <textarea name="keyDetails" defaultValue={lesson?.keyDetails} placeholder="Details to watch for (one per line)" rows={4} className="w-full rounded-xl border border-line bg-card px-3 py-3" />
      <textarea name="drills" defaultValue={lesson?.drills} placeholder="Drills" rows={4} className="w-full rounded-xl border border-line bg-card px-3 py-3" />
      <input name="youtubeUrl" defaultValue={lesson?.youtubeUrl} placeholder="YouTube watch URL (not Shorts)" className="w-full rounded-xl border border-line bg-card px-3 py-3" />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="videoPending" defaultChecked={lesson?.videoPending} className="h-5 w-5 accent-accent" />
        Video pending coach review
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="needsSupervision" defaultChecked={lesson?.needsSupervision} className="h-5 w-5 accent-accent" />
        Needs coach or partner
      </label>
      <textarea name="supervisedNote" defaultValue={lesson?.supervisedNote} placeholder="Supervision note" rows={2} className="w-full rounded-xl border border-line bg-card px-3 py-3" />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="isDemo" defaultChecked={lesson?.isDemo ?? true} className="h-5 w-5 accent-accent" />
        Label as DEMO
      </label>
      <button disabled={pending} className="touch-target w-full rounded-full bg-accent font-semibold text-black">
        {pending ? "Saving…" : "Save lesson"}
      </button>
    </form>
  );
}
