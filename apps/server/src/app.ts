import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { IoAdapter } from '@nestjs/platform-socket.io';
import type { ServerOptions } from 'socket.io';

import { LiveFlowModule } from './app.module.js';
import { ApiExceptionFilter } from './api-exception.filter.js';
import { prismaLiveRepository, type LiveRepository } from './live-repository.js';
import type { LiveFlowConfiguration } from './server-configuration.js';

export {
  LIVEFLOW_CONFIGURATION,
  LIVE_REPOSITORY,
  type DemoAccessToken,
  type LiveFlowConfiguration,
} from './server-configuration.js';

const defaultWebOrigin = 'http://localhost:3000';

export interface BuildServerOptions {
  demoAdminPassword?: string;
  demoMode?: boolean;
  jwtSecret?: string;
  liveRepository?: LiveRepository;
}

class LiveFlowIoAdapter extends IoAdapter {
  constructor(
    app: NestFastifyApplication,
    private readonly allowedOrigins: string[],
  ) {
    super(app);
  }

  override createIOServer(port: number, options?: ServerOptions) {
    return super.createIOServer(port, {
      ...options,
      cors: {
        ...options?.cors,
        origin: this.allowedOrigins,
      },
    });
  }
}

function getWebOrigins(): string[] {
  const configuredOrigins = process.env.WEB_ORIGIN ?? defaultWebOrigin;
  return configuredOrigins
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}

function getJwtSecret(options: BuildServerOptions): string {
  const configuredSecret = options.jwtSecret ?? process.env.JWT_SECRET;

  if (configuredSecret) {
    return configuredSecret;
  }

  if (process.env.NODE_ENV === 'test') {
    return 'test-only-liveflow-jwt-secret';
  }

  throw new Error('JWT_SECRET must be configured before starting the LiveFlow API server.');
}

function createConfiguration(options: BuildServerOptions): LiveFlowConfiguration {
  const demoAdminPassword = options.demoAdminPassword ?? process.env.DEMO_ADMIN_PASSWORD;

  return {
    allowedOrigins: getWebOrigins(),
    ...(demoAdminPassword ? { demoAdminPassword } : {}),
    demoMode: options.demoMode ?? process.env.DEMO_MODE !== 'false',
    jwtSecret: getJwtSecret(options),
    liveRepository: options.liveRepository ?? prismaLiveRepository,
  };
}

export async function buildServer(
  options: BuildServerOptions = {},
): Promise<NestFastifyApplication> {
  const configuration = createConfiguration(options);
  const isTestEnvironment = process.env.NODE_ENV === 'test';
  const adapter = new FastifyAdapter({
    logger: isTestEnvironment ? false : true,
    trustProxy: true,
  });
  const app = await NestFactory.create<NestFastifyApplication>(
    LiveFlowModule.register(configuration),
    adapter,
    { logger: isTestEnvironment ? false : ['log', 'warn', 'error'] },
  );

  app.enableCors({ origin: configuration.allowedOrigins });
  app.useWebSocketAdapter(new LiveFlowIoAdapter(app, configuration.allowedOrigins));
  app.useGlobalFilters(new ApiExceptionFilter());
  await app.init();

  return app;
}

export function logServerStartFailure(error: unknown): void {
  const logger = new Logger('Bootstrap');
  logger.error(
    'Failed to start the LiveFlow API server.',
    error instanceof Error ? error.stack : undefined,
  );
}
