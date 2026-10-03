import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';

const executablePath = process.env['CHROME_BIN']
  || (existsSync('/opt/google/chrome/chrome') ? '/opt/google/chrome/chrome' : undefined);

export default defineConfig({
  testDir: './e2e',
  outputDir: '.tmp/playwright-results',
  timeout: 60_000,
  expect: { timeout: 25_000 },
  workers: 1,
  fullyParallel: false,
  reporter: [['list'], ['html', { outputFolder: '.tmp/playwright-report', open: 'never' }],
    ['json', { outputFile: '.tmp/playwright-report/results.json' }]],
  use: {
    baseURL: 'http://127.0.0.1:4300',
    browserName: 'chromium',
    viewport: { width: 1440, height: 1080 },
    launchOptions: { executablePath, args: ['--no-sandbox', '--disable-dev-shm-usage', '--enable-unsafe-swiftshader'] },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  webServer: {
    command: 'npm run build && PORT=4300 node dist/personal-site/server/server.mjs',
    url: 'http://127.0.0.1:4300',
    reuseExistingServer: !process.env['CI'],
    timeout: 120_000
  }
});
