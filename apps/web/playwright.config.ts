import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, devices } from '@playwright/test';

const projectRoot = resolve(process.cwd(), '../..');
const e2eEnvironmentFile = resolve(projectRoot, '.env.e2e');

if (existsSync(e2eEnvironmentFile)) {
  process.loadEnvFile(e2eEnvironmentFile);
}

const apiPort = 4100;
const webPort = 3100;
const apiUrl = `http://127.0.0.1:${apiPort}`;
const webUrl = `http://127.0.0.1:${webPort}`;
const e2eEnvironment = {
  ...process.env,
  AI_MODE: 'mock',
  DATABASE_URL: requireE2eEnvironment('E2E_DATABASE_URL'),
  DEMO_ADMIN_PASSWORD: requireE2eEnvironment('E2E_DEMO_ADMIN_PASSWORD'),
  DEMO_MODE: 'true',
  DIRECT_URL: requireE2eEnvironment('E2E_DIRECT_URL'),
  JWT_SECRET: requireE2eEnvironment('E2E_JWT_SECRET'),
  NEXT_PUBLIC_API_URL: apiUrl,
  NEXT_PUBLIC_SOCKET_URL: apiUrl,
  WEB_ORIGIN: webUrl,
};

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',
  timeout: 45_000,
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: webUrl,
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'npm run dev:server',
      cwd: projectRoot,
      env: { ...e2eEnvironment, PORT: String(apiPort) },
      reuseExistingServer: false,
      url: `${apiUrl}/health`,
    },
    {
      command: 'npm run dev:web',
      cwd: projectRoot,
      env: { ...e2eEnvironment, PORT: String(webPort) },
      reuseExistingServer: false,
      url: webUrl,
    },
  ],
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});

function requireE2eEnvironment(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} must be configured in .env.e2e before running E2E tests.`);
  }

  return value;
}
