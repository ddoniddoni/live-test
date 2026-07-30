import { afterEach, describe, expect, it } from 'vitest';
import { buildServer } from './app.js';

const servers: Awaited<ReturnType<typeof buildServer>>[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
});

describe('health integration', () => {
  it('assigns a unique request ID to the health response', async () => {
    const app = await buildServer();
    servers.push(app);

    const response = await app.inject({ method: 'GET', url: '/health' });
    const body: unknown = response.json();

    expect(response.statusCode).toBe(200);
    expect(body).toMatchObject({
      requestId: expect.any(String),
      timestamp: expect.any(String),
    });
  });
});
