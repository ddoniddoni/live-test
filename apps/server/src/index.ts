import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const environmentFilePath = fileURLToPath(new URL('../../../.env', import.meta.url));

if (existsSync(environmentFilePath)) {
  process.loadEnvFile(environmentFilePath);
}

const { buildServer } = await import('./app.js');

const port = Number.parseInt(process.env.PORT ?? '4000', 10);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT must be an integer between 1 and 65535.');
}

const app = await buildServer();

try {
  await app.listen({ host: '0.0.0.0', port });
} catch (error: unknown) {
  app.log.error(error, 'Failed to start the LiveFlow API server.');
  await app.close();
  process.exitCode = 1;
}
