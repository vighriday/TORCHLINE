import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
if (existsSync('.env')) process.loadEnvFile('.env');
process.env.PLAYWRIGHT_BROWSERS_PATH ??= resolve('.local/browsers');
export default defineConfig({
  testDir: 'tests/browser',
  fullyParallel: false,
  workers: 1,
  timeout: 45000,
  expect: { timeout: 8000 },
  outputDir: '.local/browser-results',
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3100',
    viewport: { width: 1280, height: 900 },
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
});
