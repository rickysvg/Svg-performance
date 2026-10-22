/**
 * One primary action for the day on screen.
 * Resume wins when a session is already open. Otherwise Start.
 * Preview links are not actions: they do not create a session or start a timer.
 */

export type TrainCta = {
  verb: "Start" | "Resume";
  href: string;
};

export function primaryTrainCta(input: {
  /** Newest in-progress session. On today it is the only Resume target. */
  resumeHref?: string | null;
  /** Explicit start URL for the next session that is not finished. */
  startHref?: string | null;
}): TrainCta | null {
  const resume = input.resumeHref?.trim();
  if (resume) return { verb: "Resume", href: resume };
  const start = input.startHref?.trim();
  if (start) return { verb: "Start", href: start };
  return null;
}

/** Day chips and calendar rows open the plan. They do not start a logger. */
export function viewHref(dayParam: string, basePath: string) {
  return `${basePath}?day=${dayParam}`;
}

/**
 * The Start URL for the day on screen, when nothing is already open.
 * A replaced day starts the applied workout. A program day starts that session.
 */
export function explicitStartHref(input: {
  replaced: boolean;
  plans: readonly { id: string; complete: boolean; draftId?: string | null }[];
  action: {
    draftId?: string;
    startHref?: string;
    dayId?: string;
    href?: string;
    logHref?: string;
  } | null;
}) {
  if (input.replaced) {
    const next = input.plans.find((plan) => !plan.complete);
    return next ? `/training/my-workouts/day/${next.id}/start` : null;
  }
  const action = input.action;
  if (!action) return null;
  if (action.draftId) return `/training/log/${action.draftId}`;
  if (action.startHref) return action.startHref;
  if (action.dayId) return `/training/${action.dayId}/start`;
  return null;
}
