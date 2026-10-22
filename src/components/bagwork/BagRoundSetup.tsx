"use client";

import { useState } from "react";
import { RoundTimerButton } from "@/components/timer/RoundTimerButton";
import { TimerDurationFields } from "@/components/timer/TimerDurationFields";
import { bagworkBackHref } from "@/lib/bagwork";
import { clampDurationSeconds, clampRounds } from "@/lib/round-timer";

export function BagRoundSetup({
  workoutKey,
  workoutName,
  rounds,
  workMinutes,
  restMinutes,
}: {
  workoutKey: string;
  workoutName: string;
  rounds: number;
  workMinutes: number;
  restMinutes: number;
}) {
  const [roundCount, setRoundCount] = useState(rounds);
  const [workSeconds, setWorkSeconds] = useState(workMinutes * 60);
  const [restSeconds, setRestSeconds] = useState(restMinutes * 60);
  const launch = {
    key: workoutKey,
    name: workoutName,
    rounds: clampRounds(roundCount),
    workSeconds: clampDurationSeconds(workSeconds),
    restSeconds: clampDurationSeconds(restSeconds),
    backHref: bagworkBackHref(workoutKey),
  };

  return (
    <div className="space-y-3 rounded-2xl border border-line bg-card p-4" data-bag-round-setup>
      <p className="text-sm text-muted">
        Set the rounds yourself. The recommendation is a range, not a required count.
      </p>
      <TimerDurationFields
        rounds={roundCount}
        workSeconds={workSeconds}
        restSeconds={restSeconds}
        onChange={(next) => {
          setRoundCount(next.rounds);
          setWorkSeconds(next.workSeconds);
          setRestSeconds(next.restSeconds);
        }}
      />
      <RoundTimerButton label="Start rounds" launch={launch} mode="bag" />
    </div>
  );
}
