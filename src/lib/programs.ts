import { prisma } from "@/lib/prisma";
import { NotFoundError } from "@/lib/errors";

export const DEMO_PROGRAM_SLUG = "demo-strength-base";

export async function getDemoProgram() {
  const program = await prisma.program.findUnique({
    where: { slug: DEMO_PROGRAM_SLUG },
    include: {
      days: {
        orderBy: { dayNumber: "asc" },
        include: {
          exercises: { orderBy: { sortOrder: "asc" } },
        },
      },
    },
  });
  if (!program) {
    throw new NotFoundError(
      "The DEMO program is missing. Run npm run db:setup to load it.",
    );
  }
  return program;
}

export async function getProgramDayById(dayId: string) {
  const day = await prisma.programDay.findUnique({
    where: { id: dayId },
    include: {
      program: true,
      exercises: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!day) {
    throw new NotFoundError("That training day was not found.");
  }
  return day;
}
