import { buildCoachSystemPrompt } from "@/lib/coach/llm";
import { classifyQuestion } from "@/lib/coach/router";
import { detectSafetyRefusal } from "@/lib/coach/safety";
import { COACH_EVAL_CASES, type CoachEvalCase } from "./cases";

export type DeterministicFailure = {
  id: string;
  domain: string;
  reasons: string[];
};

export type DeterministicReport = {
  total: number;
  passed: number;
  failed: number;
  failures: DeterministicFailure[];
  byDomain: Record<string, { passed: number; total: number }>;
};

function acceptedPrimary(row: CoachEvalCase, primary: string) {
  return row.expectPrimary.includes(primary);
}

export function scoreCase(row: CoachEvalCase): DeterministicFailure | null {
  const refusal = detectSafetyRefusal(row.message);
  const route = classifyQuestion(row.message, { topic: row.topic, art: row.art });
  const reasons: string[] = [];
  if (row.expectRefusal === null) {
    if (refusal) reasons.push(`refused ${refusal.code}, expected an answer`);
  } else if (refusal?.code !== row.expectRefusal) {
    reasons.push(`refusal ${refusal?.code ?? "none"}, expected ${row.expectRefusal}`);
  }
  if (!acceptedPrimary(row, route.primary)) {
    reasons.push(`route ${route.primary}, expected ${row.expectPrimary.join(" or ")}`);
  }
  if (row.expectSecondary && !route.secondary.includes(row.expectSecondary as never)) {
    reasons.push(`missing secondary ${row.expectSecondary} (had ${route.secondary.join(", ") || "none"})`);
  }
  if (row.expectPrompt?.length) {
    const prompt = buildCoachSystemPrompt({
      topic: row.topic,
      art: row.art,
      route,
      ownSummary: "Experience: intermediate.",
      coachingStyle: row.coachingStyle,
      coachName: row.coachName,
      message: row.message,
      experienceLevel: "intermediate",
    });
    for (const needle of row.expectPrompt) {
      if (!prompt.includes(needle)) reasons.push(`prompt missing ${JSON.stringify(needle)}`);
    }
  }
  if (reasons.length === 0) return null;
  return { id: row.id, domain: row.domain, reasons };
}

export function scoreCoachEval(cases: CoachEvalCase[] = COACH_EVAL_CASES): DeterministicReport {
  const failures: DeterministicFailure[] = [];
  const byDomain: DeterministicReport["byDomain"] = {};
  for (const row of cases) {
    const domain = byDomain[row.domain] ?? { passed: 0, total: 0 };
    domain.total += 1;
    const failure = scoreCase(row);
    if (failure) failures.push(failure);
    else domain.passed += 1;
    byDomain[row.domain] = domain;
  }
  return {
    total: cases.length,
    passed: cases.length - failures.length,
    failed: failures.length,
    failures,
    byDomain,
  };
}

export function formatDeterministicReport(report: DeterministicReport) {
  const lines = [
    `Deterministic: ${report.passed}/${report.total} passed, ${report.failed} failed.`,
  ];
  for (const [domain, row] of Object.entries(report.byDomain)) {
    lines.push(`  ${domain}: ${row.passed}/${row.total}`);
  }
  for (const failure of report.failures) {
    lines.push(`- ${failure.id}: ${failure.reasons.join("; ")}`);
  }
  return lines.join("\n");
}
