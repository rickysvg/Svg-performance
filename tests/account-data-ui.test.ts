import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("account data UI copy", () => {
  it("puts Your data actions on Profile and a typed DELETE confirm", () => {
    const profile = fs.readFileSync(
      path.join(process.cwd(), "src/app/(member)/profile/page.tsx"),
      "utf8",
    );
    const section = fs.readFileSync(
      path.join(process.cwd(), "src/components/profile/YourDataSection.tsx"),
      "utf8",
    );
    const confirm = fs.readFileSync(
      path.join(process.cwd(), "src/components/profile/DeleteAccountForm.tsx"),
      "utf8",
    );
    const landing = fs.readFileSync(path.join(process.cwd(), "src/app/page.tsx"), "utf8");

    expect(profile).toContain("YourDataSection");
    expect(section).toContain("Your data");
    expect(section).toContain("Download my data");
    expect(section).toContain("Delete account");
    expect(section).toContain("bg-danger");
    expect(section).toContain("/api/account/export");
    expect(confirm).toContain("DELETE");
    expect(confirm).toContain("Permanently delete account");
    expect(confirm).not.toMatch(/\bbouts?\b/);
    expect(landing).toContain('query.deleted === "1"');
    expect(landing).toContain("Your account is gone");
  });
});
