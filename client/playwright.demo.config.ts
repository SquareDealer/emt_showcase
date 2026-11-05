import { defineConfig } from '@playwright/test';

// Screenshots of the app running on the seeded demo database. No webServer: start the backend and
// the frontend yourself (see demo/README.md). Lives in client/ because only there does
// @playwright/test resolve; the standard config (testDir ./e2e) does not see it.
export default defineConfig({
  testDir: './e2e-demo',
  outputDir: '../demo/out/playwright',
  workers: 1,
  use: {
    baseURL: process.env.DEMO_WEB_URL ?? 'http://127.0.0.1:8088',
    viewport: { width: 1440, height: 900 },
    timezoneId: 'Europe/Moscow',
    locale: 'ru-RU',
    // Installed browsers may not match the Playwright build; unset → default.
    launchOptions: { executablePath: process.env.PW_CHROMIUM_PATH || undefined },
  },
});
