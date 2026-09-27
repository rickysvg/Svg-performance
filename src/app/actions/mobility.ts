"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUserOrThrow } from "@/lib/session";
import { getProfileForUser, timeZoneForUser } from "@/lib/profile";
import { publicErrorMessage } from "@/lib/errors";
import { canUseFeature } from "@/lib/entitlements";
import { getMobilityRoutine, routineIsPro } from "@/lib/mobility";
import {
  saveMobilityCheckIn,
  saveMobilitySession,
  saveReadinessCheckIn,
  saveTestingResult,
  type CheckInInput,
  type MobilitySetInput,
  type TestingInput,
} from "@/lib/mobility-store";
import { isLoadUnit, type LoadUnit } from "@/lib/units";
import { lengthUnitForLoad } from "@/lib/length-units";
import { dayKey as zonedDayKey } from "@/lib/timezone";

export type MobilityActionState = { error?: string; success?: string };

function blankNumber(formData: FormData, key: string) {
  const raw = String(formData.get(key) ?? "").trim();
  if (raw === "") return null;
  return Number(raw);
}

function lengthUnitFor(units: LoadUnit) {
  return lengthUnitForLoad(units);
}

export async function saveMobilityLogAction(
  _prev: MobilityActionState,
  formData: FormData,
): Promise<MobilityActionState> {
  const routineId = String(formData.get("routineId") ?? "");
  try {
    const user = await requireUserOrThrow();
    const routine = getMobilityRoutine(routineId);
    if (!routine) return { error: "That routine is not on the list." };
    if (routineIsPro(routineId) && !(await canUseFeature(user.id, "mobility_pro"))) {
      return { error: "That routine is on Performance. Paid plans coming soon." };
    }
    const profile = await getProfileForUser(user.id);
    const unit = lengthUnitFor(profile?.preferredUnits ?? "lb");
    const count = Number(formData.get("rowCount") ?? 0);
    const sets: MobilitySetInput[] = [];
    for (let i = 0; i < count; i += 1) {
      sets.push({
        exerciseKey: String(formData.get(`rows.${i}.exerciseKey`) ?? ""),
        side: String(formData.get(`rows.${i}.side`) ?? ""),
        holdSeconds: blankNumber(formData, `rows.${i}.holdSeconds`),
        reps: blankNumber(formData, `rows.${i}.reps`),
        sets: blankNumber(formData, `rows.${i}.sets`),
        depthValue: blankNumber(formData, `rows.${i}.depthValue`),
        depthUnit: unit,
        heightMark: String(formData.get(`rows.${i}.heightMark`) ?? ""),
        painFlag: formData.get(`rows.${i}.pain`) === "on",
      });
    }
    const effortRaw = blankNumber(formData, "effort");
    await saveMobilitySession({
      userId: user.id,
      routineId,
      painFlag: formData.get("painFlag") === "on",
      effort: effortRaw,
      notes: String(formData.get("notes") ?? ""),
      sets,
    });
    revalidatePath("/mobility");
    revalidatePath("/home");
  } catch (error) {
    return { error: publicErrorMessage(error) };
  }
  redirect(`/mobility/${routineId}?saved=1`);
}

export async function saveCheckInAction(
  _prev: MobilityActionState,
  formData: FormData,
): Promise<MobilityActionState> {
  try {
    const user = await requireUserOrThrow();
    const profile = await getProfileForUser(user.id);
    const unit = lengthUnitFor(profile?.preferredUnits ?? "lb");
    const input: CheckInInput = {
      sitReachValue: blankNumber(formData, "sitReachValue"),
      sitReachUnit: unit,
      sitReachLevel: String(formData.get("sitReachLevel") ?? ""),
      frontSplitLeft: blankNumber(formData, "frontSplitLeft"),
      frontSplitRight: blankNumber(formData, "frontSplitRight"),
      sideSplit: blankNumber(formData, "sideSplit"),
      lengthUnit: unit,
      hipLeft: blankNumber(formData, "hipLeft"),
      hipRight: blankNumber(formData, "hipRight"),
      ankleLeft: blankNumber(formData, "ankleLeft"),
      ankleRight: blankNumber(formData, "ankleRight"),
      kickFrontLeft: String(formData.get("kickFrontLeft") ?? ""),
      kickFrontRight: String(formData.get("kickFrontRight") ?? ""),
      kickSideLeft: String(formData.get("kickSideLeft") ?? ""),
      kickSideRight: String(formData.get("kickSideRight") ?? ""),
      shoulderGap: blankNumber(formData, "shoulderGap"),
      painFlag: formData.get("painFlag") === "on",
      notes: String(formData.get("notes") ?? ""),
    };
    await saveMobilityCheckIn(user.id, input);
    revalidatePath("/mobility/check-in");
  } catch (error) {
    return { error: publicErrorMessage(error) };
  }
  redirect("/mobility/check-in?saved=1");
}

export async function saveReadinessAction(
  _prev: MobilityActionState,
  formData: FormData,
): Promise<MobilityActionState> {
  try {
    const user = await requireUserOrThrow();
    const profile = await getProfileForUser(user.id);
    const timeZone = await timeZoneForUser(user.id, profile?.timeZone ?? null);
    const dayKey = String(formData.get("dayKey") ?? "") || zonedDayKey(new Date(), timeZone);
    const result = await saveReadinessCheckIn({
      userId: user.id,
      dayKey,
      scores: {
        sleep: Number(formData.get("sleep")),
        soreness: Number(formData.get("soreness")),
        energy: Number(formData.get("energy")),
      },
      restingHr: blankNumber(formData, "restingHr"),
    });
    revalidatePath("/home");
    revalidatePath("/training");
    return {
      success: result.suggestion ?? "Readiness saved. The plan is unchanged.",
    };
  } catch (error) {
    return { error: publicErrorMessage(error) };
  }
}

export async function saveTestingAction(
  _prev: MobilityActionState,
  formData: FormData,
): Promise<MobilityActionState> {
  try {
    const user = await requireUserOrThrow();
    const profile = await getProfileForUser(user.id);
    const units: LoadUnit = isLoadUnit(profile?.preferredUnits ?? "") ? profile!.preferredUnits : "lb";
    const timeZone = await timeZoneForUser(user.id, profile?.timeZone ?? null);
    const length = lengthUnitFor(units);
    const input: TestingInput = {
      broadJumpValue: blankNumber(formData, "broadJumpValue"),
      broadJumpUnit: length,
      strengthExercise: String(formData.get("strengthExercise") ?? ""),
      strengthLoad: blankNumber(formData, "strengthLoad"),
      strengthReps: blankNumber(formData, "strengthReps"),
      strengthUnit: units,
      bikeSprintValue: blankNumber(formData, "bikeSprintValue"),
      bikeSprintUnit: String(formData.get("bikeSprintUnit") ?? "rpm"),
      bikeFiveMinValue: blankNumber(formData, "bikeFiveMinValue"),
      bikeFiveMinUnit: units === "kg" ? "km" : "mi",
      restingHr: blankNumber(formData, "restingHr"),
      notes: String(formData.get("notes") ?? ""),
    };
    await saveTestingResult(user.id, input, new Date(), timeZone);
    revalidatePath("/training/testing");
  } catch (error) {
    return { error: publicErrorMessage(error) };
  }
  redirect("/training/testing?saved=1");
}
