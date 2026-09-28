import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(rel: string) {
  return fs.readFileSync(path.join(process.cwd(), rel), "utf8");
}

describe("gymdesk UI copy", () => {
  it("uses the academy grace banner, email-code screen, and webhook URLs", () => {
    expect(read("src/components/gymdesk/GraceBanner.tsx")).toContain(
      "Your academy membership shows as inactive. Member pricing ends on",
    );
    expect(read("src/app/verify-email/page.tsx")).toContain("Confirm your email");
    expect(read("src/app/verify-email/page.tsx")).toContain("font-display");
    expect(read("src/app/verify-email/page.tsx")).toContain("SVG Coach is an AI coach");
    expect(read("src/app/(member)/profile/page.tsx")).toContain(
      "Verified via SVG MMA Academy records on",
    );
    expect(read("src/app/actions/gymdesk.ts")).toContain("The CSV file was discarded");
    expect(read("src/lib/gymdesk/config.ts")).toContain("/api/gymdesk/webhook/");
    expect(read("src/lib/gymdesk/csv.ts")).toContain("Date of birth");
    expect(read("src/lib/gymdesk/csv.ts")).toContain("Notes");
  });

  it("never says bout and stays worldwide", () => {
    const files = [
      "src/app/(member)/admin/gymdesk/page.tsx",
      "src/app/verify-email/page.tsx",
      "src/components/gymdesk/GraceBanner.tsx",
      "src/lib/gymdesk/email-code.ts",
    ];
    for (const file of files) {
      const text = read(file).toLowerCase();
      expect(text).not.toContain("bout");
      expect(text).not.toContain("el paso");
    }
  });
});
