import { defineConfig, devices } from "@playwright/test";

// Local end-to-end runs against the staging frontend on the port authorized
// in R2 CORS and Supabase Auth.
export default defineConfig({
  testDir: "./e2e",
  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: "npm run dev:staging",
    url: "http://localhost:5173",
    reuseExistingServer: true,
  },
});
