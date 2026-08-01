import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDirectory, '../../..');
const e2eEnvironmentFile = resolve(projectRoot, '.env.e2e');

if (existsSync(e2eEnvironmentFile)) {
  process.loadEnvFile(e2eEnvironmentFile);
}

const e2eEnvironment = createE2eEnvironment();

run('npm', ['run', 'db:generate']);
run('npm', ['run', 'db:migrate']);
run('npm', ['run', 'db:seed']);
run('npm', ['exec', '--', 'playwright', 'test'], resolve(projectRoot, 'apps/web'));

function createE2eEnvironment() {
  if (process.env.E2E_ALLOW_DATABASE_RESET !== 'true') {
    throw new Error(
      'E2E_ALLOW_DATABASE_RESET=true is required because E2E tests reset the dedicated test database.',
    );
  }

  return {
    ...process.env,
    DATABASE_URL: readRequiredEnvironment('E2E_DATABASE_URL'),
    DEMO_ADMIN_PASSWORD: readRequiredEnvironment('E2E_DEMO_ADMIN_PASSWORD'),
    DIRECT_URL: readRequiredEnvironment('E2E_DIRECT_URL'),
    JWT_SECRET: readRequiredEnvironment('E2E_JWT_SECRET'),
  };
}

function readRequiredEnvironment(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} must be configured in .env.e2e before running E2E tests.`);
  }

  return value;
}

function run(command, argumentsList, cwd = projectRoot) {
  const result = spawnSync(command, argumentsList, {
    cwd,
    env: e2eEnvironment,
    stdio: 'inherit',
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
