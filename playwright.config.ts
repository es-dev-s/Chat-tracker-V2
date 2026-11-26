import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT || 5666);
const baseURL = process.env.E2E_BASE_URL || `http://localhost:${PORT}`;

/**
 * E2E tests run against the LOCAL app + LOCAL Supabase only (see e2e/seed.ts).
 * Reuses a dev server already running on the port, otherwise starts `npm run dev`.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["setup"],
    },
  ],
  webServer: {
    command: `npx next dev -p ${PORT}`,
    url: `${baseURL}/login`,
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
