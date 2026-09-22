"use server";

import { revalidatePath } from "next/cache";
import { requireAdminOrThrow } from "@/lib/roles";
import { upsertFocusVideo } from "@/lib/focus-videos";
import { publicErrorMessage } from "@/lib/errors";

export type FocusActionState = { error?: string; success?: string };

export async function saveFocusVideoAction(
  _prev: FocusActionState,
  formData: FormData,
): Promise<FocusActionState> {
  try {
    const admin = await requireAdminOrThrow();
    const file = formData.get("clip");
    let bytes: Uint8Array | undefined;
    let claimedType: string | undefined;
    if (file instanceof File && file.size > 0) {
      bytes = new Uint8Array(await file.arrayBuffer());
      claimedType = file.type;
    }
    await upsertFocusVideo({
      adminUserId: admin.id,
      id: String(formData.get("id") ?? "") || undefined,
      title: String(formData.get("title") ?? ""),
      weekStart: String(formData.get("weekStart") ?? ""),
      videoUrl: String(formData.get("videoUrl") ?? ""),
      scriptNotes: String(formData.get("scriptNotes") ?? ""),
      status: String(formData.get("status") ?? "draft"),
      isDemo: formData.get("isDemo") === "on",
      bytes,
      claimedType,
    });
    revalidatePath("/admin/focus");
    revalidatePath("/home");
    return { success: "Focus video saved. Drafts stay hidden until you publish." };
  } catch (error) {
    return { error: publicErrorMessage(error) };
  }
}
