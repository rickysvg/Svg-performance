import { spawnSync } from "node:child_process";

const result = spawnSync(
  "npx",
  ["vitest", "run", "evals/coach/baseline.test.ts", "evals/coach/judge.test.ts"],
  {
    stdio: "inherit",
    env: { ...process.env, COACH_EVAL_JUDGE: "1" },
  },
);

process.exit(result.status ?? 1);
