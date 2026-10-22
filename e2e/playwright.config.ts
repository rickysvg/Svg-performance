import { defineConfig } from "@playwright/test";
// Preview or production URL. CI sets this from the Vercel deployment.
// Local default is production. Sign in only as the QA test account.
const baseURL = process.env.BASE_URL || "https://svg-performance.vercel.app";
export default defineConfig({
  testDir: "./tests",
  timeout: 180_000,
  retries: 0,
  workers: 3,
  reporter: [["list"], ["json", { outputFile: "results/report.json" }], ["html", { open: "never", outputFolder: "results/html" }]],
  outputDir: "results/artifacts",
  use: { baseURL, trace: "retain-on-failure", screenshot: "only-on-failure", hasTouch: true, isMobile: true },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    { name: "m375", testMatch: /specs\/.*\.spec\.ts/, dependencies: ["setup"], use: { viewport: { width: 375, height: 812 }, deviceScaleFactor: 2 } },
    { name: "m430", testMatch: /specs\/.*\.spec\.ts/, dependencies: ["setup"], use: { viewport: { width: 430, height: 932 }, deviceScaleFactor: 3 } },
  ],
});
