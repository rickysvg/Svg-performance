"use client";

import { useState } from "react";
import {
  AI_COACHES,
  COACHING_STYLES,
  resolveAiCoach,
  resolveCoachingStyle,
} from "@/lib/coaches";

export function CoachPicker({
  coachId,
  coachingStyle,
  idPrefix = "coach",
}: {
  coachId?: string;
  coachingStyle?: string;
  idPrefix?: string;
}) {
  const [coach, setCoach] = useState(resolveAiCoach(coachId).id);
  const [style, setStyle] = useState(resolveCoachingStyle(coachingStyle).value);

  return (
    <div className="space-y-5">
      <fieldset>
        <legend className="text-sm font-medium">Coach</legend>
        <p className="mt-1 text-xs text-muted">Pick the face you want in SVG Coach.</p>
        <div className="mt-3 grid grid-cols-2 gap-3">
          {AI_COACHES.map((item) => {
            const selected = coach === item.id;
            return (
              <label
                key={item.id}
                data-coach-option={item.id}
                className={`block cursor-pointer overflow-hidden rounded-2xl border-2 bg-background ${
                  selected ? "border-accent" : "border-line"
                }`}
              >
                <input
                  data-testid={`chrome-ai-coach-id-${item.id}`}
                  type="radio"
                  name="aiCoachId"
                  value={item.id}
                  checked={selected}
                  onChange={() => setCoach(item.id)}
                  className="sr-only"
                  required
                />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.image}
                  alt=""
                  width={512}
                  height={512}
                  className="aspect-square w-full object-cover"
                />
                <span className="block px-3 pt-2 font-display text-base uppercase tracking-wide">
                  {item.name}
                </span>
                <span className="block px-3 pb-3 text-xs text-muted">{item.vibe}</span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <fieldset>
        <legend id={`${idPrefix}-style`} className="text-sm font-medium">
          Coaching style
        </legend>
        <div className="mt-2 grid gap-2" role="radiogroup" aria-labelledby={`${idPrefix}-style`}>
          {COACHING_STYLES.map((item) => {
            const selected = style === item.value;
            return (
              <label
                key={item.value}
                data-coach-style={item.value}
                className={`flex cursor-pointer items-start gap-3 rounded-2xl border-2 px-3 py-3 text-sm ${
                  selected ? "border-accent bg-accent/15" : "border-line bg-background"
                }`}
              >
                <input
                  data-testid={`chrome-coaching-style-${item.value}`}
                  type="radio"
                  name="coachingStyle"
                  value={item.value}
                  checked={selected}
                  onChange={() => setStyle(item.value)}
                  className="mt-1 h-5 w-5 accent-accent"
                  required
                />
                <span>
                  <span className="font-medium">{item.label}</span>
                  <span className="mt-0.5 block text-xs text-muted">{item.blurb}</span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>
    </div>
  );
}
