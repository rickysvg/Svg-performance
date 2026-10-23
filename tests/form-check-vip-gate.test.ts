import { createElement, type ReactNode } from "react";
import { readFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { ForbiddenError } from "@/lib/errors";
import { makeUser, resetDatabase } from "./helpers";
import { canUseFeature, getEffectivePlanId } from "@/lib/entitlements";
import { startTrialForUser } from "@/lib/trial";
import {
  canUseFormCheck,
  formCheckLockedFor,
  isFormCheckReviewer,
} from "@/lib/form-check-access";
import { CATALOG_PLAN_IDS, planHasFeature, type CatalogPlanId } from "@/lib/plans";
import {
  FORM_CHECK_APPLY_PATH,
  FORM_CHECK_LOCKED_BODY,
  FORM_CHECK_LOCKED_TITLE,
} from "@/lib/form-check-shared";
import { createFormCheckForUser } from "@/lib/form-check";
import { HomeQuickActions } from "@/components/home/HomeQuickActions";
import { ProTools } from "@/components/home/ProTools";
import {
  FormCheckLockedSheet,
  FormCheckLockedTrigger,
  FormCheckLockedView,
} from "@/components/form-check/FormCheckLockedSheet";
import { GET } from "@/app/api/form-checks/[checkId]/route";
import { markFormCheckSeenAction, uploadFormCheckAction } from "@/app/actions/form-check";
import { getCurrentUser, requireUserOrThrow } from "@/lib/session";

vi.mock("next/image", () => ({
  default: ({ alt, src }: { alt?: string; src?: string }) =>
    createElement("img", { alt: alt ?? "", src: src ?? "" }),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children?: ReactNode }) =>
    createElement("a", { href, ...props }, children),
}));

vi.mock("@/lib/session", () => ({
  getCurrentUser: vi.fn(),
  requireUserOrThrow: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const currentUser = vi.mocked(getCurrentUser);
const requireUser = vi.mocked(requireUserOrThrow);

function tinyMp4() {
  const bytes = new Uint8Array(16);
  bytes[3] = 16;
  bytes[4] = 0x66;
  bytes[5] = 0x74;
  bytes[6] = 0x79;
  bytes[7] = 0x70;
  return bytes;
}

async function grantPlan(userId: string, plan: string) {
  await prisma.subscription.create({
    data: {
      userId,
      plan,
      status: "active",
      currentPeriodEnd: new Date("2027-12-01T00:00:00.000Z"),
      source: "admin",
    },
  });
}

async function verifyAcademy(userId: string) {
  await prisma.profile.update({
    where: { userId },
    data: { gymMembershipVerified: true },
  });
}

describe("form check is VIP Coaching only", () => {
  let dir = "";

  beforeEach(async () => {
    await resetDatabase();
    dir = await mkdtemp(path.join(os.tmpdir(), "svg-form-check-gate-"));
    process.env.FORM_CHECK_DIR = dir;
    delete process.env.BLOB_READ_WRITE_TOKEN;
    delete process.env.ADMIN_EMAILS;
    currentUser.mockReset();
    requireUser.mockReset();
  });

  afterAll(async () => {
    if (dir) await rm(dir, { recursive: true, force: true });
    await prisma.$disconnect();
  });

  it("locks every plan except VIP Coaching, and leaves admins and coaches open", () => {
    for (const planId of CATALOG_PLAN_IDS) {
      const locked = planId !== "coaching";
      expect(planHasFeature(planId, "form_check"), planId).toBe(!locked);
      expect(formCheckLockedFor({ role: "member", planId }), planId).toBe(locked);
    }
    expect(formCheckLockedFor({ role: "admin", planId: "member_access" })).toBe(false);
    expect(formCheckLockedFor({ role: "coach", planId: "performance" })).toBe(false);
    expect(formCheckLockedFor({ role: "coach", planId: "academy" })).toBe(false);
  });

  it("returns 403 for free, Pro, Pro trial, and Academy, and allows VIP, admin, and coach", async () => {
    const now = new Date("2026-10-22T12:00:00.000Z");
    const free = await makeUser("gate-free@example.com");
    const pro = await makeUser("gate-pro@example.com");
    const trial = await makeUser("gate-trial@example.com");
    const academy = await makeUser("gate-academy@example.com");
    const vip = await makeUser("gate-vip@example.com");
    const admin = await makeUser("gate-admin@example.com", false, "admin");
    const coach = await makeUser("gate-coach@example.com", false, "coach");

    await grantPlan(pro.id, "performance");
    await startTrialForUser(trial.id, now);
    await verifyAcademy(academy.id);
    await grantPlan(vip.id, "coaching");

    expect(await getEffectivePlanId(free.id, now)).toBe("member_access");
    expect(await getEffectivePlanId(pro.id, now)).toBe("performance");
    expect(await getEffectivePlanId(trial.id, now)).toBe("performance");
    expect(await getEffectivePlanId(academy.id, now)).toBe("academy");
    expect(await getEffectivePlanId(vip.id, now)).toBe("coaching");

    const denied = [free, pro, trial, academy];
    for (const user of denied) {
      expect(await canUseFeature(user.id, "form_check", now), user.email).toBe(false);
      expect(await canUseFormCheck(user, now), user.email).toBe(false);
      expect(formCheckLockedFor({ role: user.role, planId: await getEffectivePlanId(user.id, now) })).toBe(
        true,
      );
      await expect(
        createFormCheckForUser({
          userId: user.id,
          movementId: "jab-cross",
          customMovement: "",
          note: "",
          durationSeconds: 8,
          bytes: tinyMp4(),
          claimedType: "video/mp4",
          now,
          timeZone: "UTC",
        }),
        user.email,
      ).rejects.toMatchObject({
        status: 403,
        code: "FORBIDDEN",
        message: FORM_CHECK_LOCKED_TITLE,
      });
    }
    expect(await prisma.formCheck.count()).toBe(0);

    for (const user of [vip, admin, coach]) {
      expect(await canUseFormCheck(user, now), user.email).toBe(true);
      expect(
        formCheckLockedFor({
          role: user.role,
          planId: (await getEffectivePlanId(user.id, now)) as CatalogPlanId,
        }),
        user.email,
      ).toBe(false);
      await expect(
        createFormCheckForUser({
          userId: user.id,
          movementId: "low-kick",
          customMovement: "",
          note: "Check the hip.",
          durationSeconds: 8,
          bytes: tinyMp4(),
          claimedType: "video/mp4",
          now,
          timeZone: "UTC",
        }),
      ).resolves.toMatchObject({ status: "submitted", userId: user.id });
    }
  });

  it("returns 403 from the upload action, the seen action, and the form-check API", async () => {
    const now = new Date("2026-10-22T12:00:00.000Z");
    const pro = await makeUser("api-pro@example.com");
    const trial = await makeUser("api-trial@example.com");
    const academy = await makeUser("api-academy@example.com");
    const free = await makeUser("api-free@example.com");
    const vip = await makeUser("api-vip@example.com");
    const coach = await makeUser("api-coach@example.com", false, "coach");
    const reviewer = await makeUser("api-reviewer@example.com");
    await grantPlan(pro.id, "performance");
    await startTrialForUser(trial.id, now);
    await verifyAcademy(academy.id);
    await grantPlan(vip.id, "coaching");
    process.env.ADMIN_EMAILS = reviewer.email;
    expect(isFormCheckReviewer(reviewer)).toBe(true);

    for (const user of [free, pro, trial, academy]) {
      requireUser.mockResolvedValue(user);
      await expect(uploadFormCheckAction({}, new FormData()), user.email).rejects.toBeInstanceOf(
        ForbiddenError,
      );
      await expect(uploadFormCheckAction({}, new FormData()), user.email).rejects.toMatchObject({
        status: 403,
        message: FORM_CHECK_LOCKED_TITLE,
      });
      await expect(markFormCheckSeenAction(), user.email).rejects.toMatchObject({ status: 403 });

      currentUser.mockResolvedValue(user);
      const response = await GET(new Request("http://localhost/api/form-checks/missing"), {
        params: Promise.resolve({ checkId: "missing" }),
      });
      expect(response.status, user.email).toBe(403);
      await expect(response.json()).resolves.toMatchObject({ error: FORM_CHECK_LOCKED_TITLE });
    }

    requireUser.mockResolvedValue(vip);
    await expect(uploadFormCheckAction({}, new FormData())).resolves.toMatchObject({
      error: expect.stringMatching(/mp4/),
    });
    requireUser.mockResolvedValue(coach);
    await expect(markFormCheckSeenAction()).resolves.toBeUndefined();

    currentUser.mockResolvedValue(vip);
    const missing = await GET(new Request("http://localhost/api/form-checks/missing"), {
      params: Promise.resolve({ checkId: "missing" }),
    });
    expect(missing.status).toBe(404);

    currentUser.mockResolvedValue(reviewer);
    const reviewGate = await GET(new Request("http://localhost/api/form-checks/missing"), {
      params: Promise.resolve({ checkId: "missing" }),
    });
    expect(reviewGate.status).toBe(404);

    const clip = await createFormCheckForUser({
      userId: vip.id,
      movementId: "teep",
      customMovement: "",
      note: "",
      durationSeconds: 6,
      bytes: tinyMp4(),
      claimedType: "video/mp4",
      now,
      timeZone: "UTC",
    });
    currentUser.mockResolvedValue(pro);
    const blocked = await GET(new Request(`http://localhost/api/form-checks/${clip.id}`), {
      params: Promise.resolve({ checkId: clip.id }),
    });
    expect(blocked.status).toBe(403);

    currentUser.mockResolvedValue(vip);
    const opened = await GET(new Request(`http://localhost/api/form-checks/${clip.id}`), {
      params: Promise.resolve({ checkId: clip.id }),
    });
    expect(opened.status).toBe(200);
    expect(opened.headers.get("content-type")).toBe("video/mp4");
  });

  it("shows a lock on every entry point and a VIP sheet with stable test ids", () => {
    const lockedHome = renderToStaticMarkup(
      createElement(HomeQuickActions, { formCheckLocked: true }),
    );
    expect(lockedHome).toContain("form-check-locked-trigger-home");
    expect(lockedHome).toContain("form-check-lock-icon");
    expect(lockedHome).toContain("Form check");
    expect(lockedHome).not.toContain('href="/form-check"');

    const openHome = renderToStaticMarkup(
      createElement(HomeQuickActions, { formCheckLocked: false }),
    );
    expect(openHome).toContain('href="/form-check"');
    expect(openHome).toContain("home-link-form-check");
    expect(openHome).not.toContain("form-check-lock-icon");

    const profile = renderToStaticMarkup(
      createElement(
        FormCheckLockedTrigger,
        {
          testId: "form-check-locked-trigger-profile",
          lock: "inline",
          className: "inline-flex",
        },
        "Form check",
      ),
    );
    expect(profile).toContain("form-check-locked-trigger-profile");
    expect(profile).toContain("form-check-lock-icon");
    expect(profile).not.toContain('href="/form-check"');

    const tools = renderToStaticMarkup(
      createElement(ProTools, {
        camp: null,
        formChecksLeft: 2,
        formCheckLimit: 2,
        unseenFormChecks: 0,
        locked: true,
        formCheckLocked: true,
      }),
    );
    expect(tools).toContain("form-check-locked-trigger-tools");
    expect(tools).toContain("form-check-lock-icon");
    expect(tools).toContain("VIP Coaching members only");
    expect(tools).not.toContain('href="/form-check"');
    expect(tools).not.toContain("Two clips a month");

    const page = renderToStaticMarkup(createElement(FormCheckLockedView, { initialOpen: true }));
    expect(page).toContain("form-check-locked-trigger-page");
    expect(page).toContain("form-check-locked-sheet");

    const sheet = renderToStaticMarkup(
      createElement(FormCheckLockedSheet, { open: true, onClose: () => undefined }),
    );
    expect(sheet).toContain('data-testid="form-check-locked-sheet"');
    expect(sheet).toContain('data-testid="form-check-locked-backdrop"');
    expect(sheet).toContain('data-testid="form-check-locked-close"');
    expect(sheet).toContain('data-testid="form-check-locked-title"');
    expect(sheet).toContain('data-testid="form-check-locked-cta"');
    expect(sheet).toContain(FORM_CHECK_LOCKED_TITLE);
    expect(sheet).toContain(FORM_CHECK_LOCKED_BODY);
    expect(sheet).toContain(`href="${FORM_CHECK_APPLY_PATH}"`);
    expect(sheet).toContain("#CBF805");
    expect(sheet).toContain("#FF3B3B");
    expect(sheet).toContain("hc-carbon");
    expect(sheet).toContain('aria-label="Close"');
    expect(sheet.toLowerCase()).not.toMatch(/spot/);
    expect(sheet).not.toMatch(/\b20\b|\b3 spots\b|open seats/i);
    expect(renderToStaticMarkup(createElement(FormCheckLockedSheet, { open: false, onClose: () => undefined }))).toBe(
      "",
    );

    const source = readFileSync("src/components/form-check/FormCheckLockedSheet.tsx", "utf8");
    expect(source).toContain("useSheetBehavior");
    expect(source).toContain("onSheetBackdropMouseDown");
    expect(source).toContain("form-check-locked-close");

    const copyFiles = [
      "src/components/upgrade/UpgradePreview.tsx",
      "src/app/(member)/form-check/page.tsx",
      "src/components/home/ProTools.tsx",
      "src/components/home/HomeQuickActions.tsx",
      "src/components/form-check/FormCheckLockedSheet.tsx",
      "src/lib/pricing-ladder.ts",
      "src/lib/form-check.ts",
    ];
    for (const file of copyFiles) {
      const text = readFileSync(file, "utf8");
      expect(text, file).not.toMatch(/Form check is in Pro/i);
      expect(text, file).not.toMatch(/AI\/self/);
      expect(text, file).not.toMatch(/Two clips a month/);
      expect(text, file).not.toMatch(/Paid plans coming soon/);
    }
    expect(readFileSync("src/app/(member)/form-check/page.tsx", "utf8")).not.toContain("ProPill");
    expect(readFileSync("src/app/(member)/home/page.tsx", "utf8")).toContain("formCheckLockedFor");
    expect(readFileSync("src/app/(member)/profile/page.tsx", "utf8")).toContain(
      "form-check-locked-trigger-profile",
    );
  });
});
