import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  use: { baseURL: `http://localhost:${PORT}` },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    // MOCK_PROVIDERS makes /api/* answer from fixtures, so e2e never hits public servers.
    command: `npm run build && npx next start -p ${PORT}`,
    env: { MOCK_PROVIDERS: "1" },
    port: PORT,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
  },
});
