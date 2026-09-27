import { requireUser } from "@/lib/session";
import { RoundTimer } from "@/components/timer/RoundTimer";

export default async function TimerPage() {
  await requireUser();
  return (
    <main>
      <RoundTimer />
    </main>
  );
}
