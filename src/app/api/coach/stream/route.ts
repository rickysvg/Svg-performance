import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { getProfileForUser } from "@/lib/profile";
import { resolveAiCoach, resolveCoachingStyle } from "@/lib/coaches";
import { AppError, AuthError } from "@/lib/errors";
import { AiCapError } from "@/lib/ai-usage";
import {
  coachStreamResponse,
  handleCoachStreamRequest,
  type CoachStreamRequest,
} from "@/lib/coach/stream";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in to talk to SVG Coach." }, { status: 401 });
  }

  let body: CoachStreamRequest;
  try {
    body = (await request.json()) as CoachStreamRequest;
  } catch {
    return NextResponse.json({ error: "That request was not valid JSON." }, { status: 400 });
  }

  const profile = await getProfileForUser(user.id);
  const coach = resolveAiCoach(profile?.aiCoachId);
  const style = resolveCoachingStyle(profile?.coachingStyle);
  const payload: CoachStreamRequest = {
    ...body,
    experienceLevel: body.experienceLevel || profile?.experienceLevel,
    coachingTone: body.coachingTone || profile?.coachingTone,
    coachingStyle: style.value,
    coachName: coach.name,
  };

  return coachStreamResponse(user, payload, request.signal);
}

export async function coachStreamForTest(
  user: Awaited<ReturnType<typeof getCurrentUser>>,
  body: CoachStreamRequest,
  signal?: AbortSignal,
) {
  try {
    return await handleCoachStreamRequest({ user, body, signal });
  } catch (error) {
    if (error instanceof AuthError) {
      return { status: 401, error: error.message };
    }
    if (error instanceof AiCapError) {
      return { status: 402, error: error.message, paywall: error.reason };
    }
    if (error instanceof AppError) {
      return { status: error.status, error: error.message };
    }
    throw error;
  }
}
