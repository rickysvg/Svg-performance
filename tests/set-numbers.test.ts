import fs from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as {
  DatabaseSync: new (path: string) => {
    exec(sql: string): void;
    prepare(sql: string): {
      run(...args: unknown[]): void;
      all(): { id: string }[];
    };
    close(): void;
  };
};
import { bikeChoiceById } from "@/lib/bike-chooser";
import { BIKE_TIMER_EXERCISE, bikeTimerLogSets } from "@/lib/bike-timer-log";
import { bagworkRoundSets } from "@/lib/bagwork-store";
import { mergeReplacementSets } from "@/lib/exercise-swap-store";
import { libraryExercise } from "@/lib/exercise-library";
import { draftsForLibraryExercise, highestSetNumber } from "@/lib/logger-insert";

describe("new sets follow the highest number already in the session", () => {
  it("continues a library exercise past the sets that exercise already has", () => {
    const goblet = libraryExercise("Goblet squat");
    expect(goblet).toBeTruthy();
    const occupied = [
      { exerciseName: "Squat", setNumber: 1 },
      { exerciseName: "Goblet squat", setNumber: 4 },
      { exerciseName: "Goblet squat", setNumber: 2 },
    ];
    expect(highestSetNumber(occupied, "Goblet squat")).toBe(4);
    const drafts = draftsForLibraryExercise(["Squat"], goblet!, occupied);
    expect(drafts[0]?.exerciseName).toBe("Goblet squat");
    expect(drafts.map((draft) => draft.setNumber)).toEqual(
      Array.from({ length: goblet!.sets }, (_, index) => 5 + index),
    );
    const renamed = draftsForLibraryExercise(
      occupied.map((set) => set.exerciseName),
      goblet!,
      occupied,
    );
    expect(renamed[0]?.exerciseName).toBe("Goblet squat · 2");
    expect(renamed[0]?.setNumber).toBe(1);
  });

  it("continues a swap onto a name that already has a higher set", () => {
    const merged = mergeReplacementSets(
      [
        {
          exerciseName: "Curl",
          setNumber: 5,
          reps: 8,
          loadValue: 20,
          loadUnit: "lb",
          logMode: "load_reps",
          completed: true,
        },
        {
          exerciseName: "Press",
          setNumber: 1,
          reps: 6,
          loadValue: null,
          loadUnit: "lb",
          logMode: "load_reps",
          completed: false,
        },
      ],
      ["Press"],
      { name: "Curl", sets: 2, reps: "8", loadText: "", logMode: "load_reps" },
      { programSlug: "demo", dayNumber: 1, loadUnit: "lb" },
    );
    const keys = merged.map((set) => `${set.exerciseName}#${set.setNumber}`);
    expect(new Set(keys).size).toBe(keys.length);
    expect(merged.find((set) => set.exerciseName === "Curl")?.setNumber).toBe(5);
    expect(merged.some((set) => set.exerciseName === "Curl" && set.setNumber === 1)).toBe(false);
    expect(merged.some((set) => set.exerciseName === "Curl · 2" && set.setNumber === 1)).toBe(true);
  });

  it("numbers bag rounds and bike intervals after the sets already logged", () => {
    const bag = bagworkRoundSets({
      exerciseName: "All hooks",
      rounds: 2,
      workSeconds: 180,
      existing: [
        { exerciseName: "All hooks", setNumber: 3 },
        { exerciseName: "Jab", setNumber: 9 },
      ],
    });
    expect(bag.map((set) => set.setNumber)).toEqual([4, 5]);

    const choice = bikeChoiceById("tabata");
    expect(choice).toBeTruthy();
    const fresh = bikeTimerLogSets(choice!, "lb", 2);
    expect(fresh.map((set) => set.setNumber)).toEqual([1, 2]);
    const next = bikeTimerLogSets(choice!, "lb", 2, [
      { exerciseName: BIKE_TIMER_EXERCISE, setNumber: 6 },
      { exerciseName: "Warm-up", setNumber: 1 },
    ]);
    expect(next.map((set) => set.setNumber)).toEqual([7, 8]);
    expect(next.every((set) => set.exerciseName === BIKE_TIMER_EXERCISE)).toBe(true);
  });
});

describe("duplicate set slots", () => {
  it("keeps the ticked or logged row, then the lowest rowid", () => {
    const sql = fs.readFileSync("prisma/migrations/20261022170000_workout_set_slot/migration.sql", "utf8");
    const db = new DatabaseSync(":memory:");
    db.exec(`
      CREATE TABLE "WorkoutSet" (
        "id" TEXT NOT NULL,
        "workoutSessionId" TEXT NOT NULL,
        "exerciseName" TEXT NOT NULL,
        "setNumber" INTEGER NOT NULL,
        "reps" INTEGER,
        "loadValue" REAL,
        "durationSeconds" INTEGER,
        "completed" BOOLEAN NOT NULL DEFAULT false,
        "notes" TEXT NOT NULL DEFAULT ''
      );
    `);
    const insert = db.prepare(
      `INSERT INTO "WorkoutSet" ("id", "workoutSessionId", "exerciseName", "setNumber", "reps", "loadValue", "durationSeconds", "completed", "notes")
       VALUES (?, 'session', 'Curl', 1, ?, ?, ?, ?, ?)`,
    );
    insert.run("blank", null, null, null, 0, "");
    insert.run("logged", 8, 25, null, 0, "");
    insert.run("ticked-later", 8, 25, null, 1, "hard");
    insert.run("note-only", null, null, null, 0, "felt good");
    const cleanup = sql.slice(0, sql.indexOf("CREATE UNIQUE INDEX")).trim();
    db.exec(cleanup);
    const kept = db.prepare(
      `SELECT "id", "reps", "loadValue", "completed", "notes" FROM "WorkoutSet" ORDER BY rowid`,
    ).all() as { id: string; reps: number; loadValue: number; completed: number; notes: string }[];
    expect(kept.map((row) => row.id)).toEqual(["ticked-later"]);
    expect(kept[0]).toMatchObject({ reps: 8, loadValue: 25, completed: 1, notes: "hard\nfelt good" });

    const tie = db.prepare(
      `INSERT INTO "WorkoutSet" ("id", "workoutSessionId", "exerciseName", "setNumber", "reps", "loadValue", "durationSeconds", "completed", "notes")
       VALUES (?, 'session', 'Press', 1, NULL, NULL, NULL, 0, '')`,
    );
    tie.run("low");
    tie.run("high");
    db.exec(cleanup);
    const oldest = db.prepare(`SELECT "id" FROM "WorkoutSet" WHERE "exerciseName" = 'Press'`).all() as {
      id: string;
    }[];
    expect(oldest.map((row) => row.id)).toEqual(["low"]);
    db.close();
  });

  it("keeps 5x100 when the other copy is only ticked, and marks that row done", () => {
    const sql = fs.readFileSync("prisma/migrations/20261022170000_workout_set_slot/migration.sql", "utf8");
    const db = new DatabaseSync(":memory:");
    db.exec(`
      CREATE TABLE "WorkoutSet" (
        "id" TEXT NOT NULL,
        "workoutSessionId" TEXT NOT NULL,
        "exerciseName" TEXT NOT NULL,
        "setNumber" INTEGER NOT NULL,
        "reps" INTEGER,
        "loadValue" REAL,
        "durationSeconds" INTEGER,
        "completed" BOOLEAN NOT NULL DEFAULT false,
        "notes" TEXT NOT NULL DEFAULT ''
      );
    `);
    db.prepare(
      `INSERT INTO "WorkoutSet" ("id", "workoutSessionId", "exerciseName", "setNumber", "reps", "loadValue", "durationSeconds", "completed", "notes")
       VALUES (?, 'session', 'Squat', 1, ?, ?, NULL, ?, '')`,
    ).run("ticked-empty", null, null, 1);
    db.prepare(
      `INSERT INTO "WorkoutSet" ("id", "workoutSessionId", "exerciseName", "setNumber", "reps", "loadValue", "durationSeconds", "completed", "notes")
       VALUES (?, 'session', 'Squat', 1, ?, ?, NULL, ?, '')`,
    ).run("five-by-hundred", 5, 100, 0);
    db.exec(sql.slice(0, sql.indexOf("CREATE UNIQUE INDEX")).trim());
    const kept = db.prepare(
      `SELECT "id", "reps", "loadValue", "completed" FROM "WorkoutSet"`,
    ).all() as { id: string; reps: number; loadValue: number; completed: number }[];
    expect(kept).toEqual([{ id: "five-by-hundred", reps: 5, loadValue: 100, completed: 1 }]);
    db.close();
  });

  it("joins distinct notes from the duplicate onto the kept row", () => {
    const sql = fs.readFileSync("prisma/migrations/20261022170000_workout_set_slot/migration.sql", "utf8");
    const db = new DatabaseSync(":memory:");
    db.exec(`
      CREATE TABLE "WorkoutSet" (
        "id" TEXT NOT NULL,
        "workoutSessionId" TEXT NOT NULL,
        "exerciseName" TEXT NOT NULL,
        "setNumber" INTEGER NOT NULL,
        "reps" INTEGER,
        "loadValue" REAL,
        "durationSeconds" INTEGER,
        "completed" BOOLEAN NOT NULL DEFAULT false,
        "notes" TEXT NOT NULL DEFAULT ''
      );
    `);
    const insert = db.prepare(
      `INSERT INTO "WorkoutSet" ("id", "workoutSessionId", "exerciseName", "setNumber", "reps", "loadValue", "durationSeconds", "completed", "notes")
       VALUES (?, 'session', 'Hinge', 2, ?, NULL, NULL, ?, ?)`,
    );
    insert.run("logged", 8, 0, "hips tight");
    insert.run("same-note", null, 1, "hips tight");
    insert.run("other-note", null, 0, "watch the elbow");
    db.exec(sql.slice(0, sql.indexOf("CREATE UNIQUE INDEX")).trim());
    const kept = db.prepare(`SELECT "id", "reps", "completed", "notes" FROM "WorkoutSet"`).all() as {
      id: string;
      reps: number;
      completed: number;
      notes: string;
    }[];
    expect(kept).toEqual([
      { id: "logged", reps: 8, completed: 1, notes: "hips tight\nwatch the elbow" },
    ]);
    db.close();
  });
});
