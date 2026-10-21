import Link from "next/link";
import { requireUser } from "@/lib/session";
import { getProfileForUser, timeZoneForUser } from "@/lib/profile";
import { listSavedWorkouts } from "@/lib/my-workouts";
import { formatLastUsed } from "@/lib/my-workout-plan";
import { formatDayParam } from "@/lib/home";
import { MyWorkoutCard } from "@/components/training/MyWorkoutCard";
import { EmptyState } from "@/components/EmptyState";

export default async function MyWorkoutsPage() {
  const user = await requireUser();
  const profile = await getProfileForUser(user.id);
  const timeZone = await timeZoneForUser(user.id, profile?.timeZone ?? null);
  const workouts = await listSavedWorkouts(user.id);
  const todayKey = formatDayParam(new Date(), timeZone);

  return (
    <main className="space-y-6" data-my-workouts>
      <div>
        <Link href="/training" className="text-sm text-accent underline-offset-4 hover:underline">
          Back to Training
        </Link>
        <h1 className="mt-2 text-2xl">My Workouts</h1>
        <p className="mt-1 text-sm text-muted">
          Saved exercise lists. Start one now, or apply it to any date.
        </p>
      </div>
      {workouts.length === 0 ? (
        <EmptyState
          title="No saved workouts"
          action={
            <Link href="/training" className="text-accent underline">
              Train
            </Link>
          }
        >
          Save a list from the logger, the Done screen, or Workout history.
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {workouts.map((workout) => (
            <li key={workout.id}>
              <MyWorkoutCard
                id={workout.id}
                name={workout.name}
                exerciseCount={workout.exerciseCount}
                lastUsedLabel={formatLastUsed(workout.lastUsedAt, timeZone)}
                todayKey={todayKey}
              />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
