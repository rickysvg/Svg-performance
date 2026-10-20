import { prisma } from "@/lib/prisma";
import { NotFoundError } from "@/lib/errors";
import { ensureDemoCatalog } from "@/lib/demo-catalog-sync";

export const DEMO_PROGRAM_SLUG = "demo-strength-base";
export const DEMO_SKILL_PROGRAM_SLUG = "demo-combat-skills";

const programInclude = {
  days: {
    orderBy: { dayNumber: "asc" as const },
    include: {
      exercises: { orderBy: { sortOrder: "asc" as const } },
    },
  },
};

export async function findDemoProgram() {
  await ensureDemoCatalog();
  return prisma.program.findUnique({
    where: { slug: DEMO_PROGRAM_SLUG },
    include: programInclude,
  });
}

export async function findSkillProgram() {
  await ensureDemoCatalog();
  return prisma.program.findUnique({
    where: { slug: DEMO_SKILL_PROGRAM_SLUG },
    include: programInclude,
  });
}

export async function findDemoTrainingCatalog() {
  const [strength, skill] = await Promise.all([findDemoProgram(), findSkillProgram()]);
  return { strength, skill };
}

export async function getDemoProgram() {
  const program = await findDemoProgram();
  if (!program) {
    throw new NotFoundError(
      "The training program is missing. Run npm run db:setup to load it.",
    );
  }
  return program;
}

export async function getProgramDayById(dayId: string) {
  await ensureDemoCatalog();
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
