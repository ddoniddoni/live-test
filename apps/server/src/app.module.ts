import { Module } from '@nestjs/common';
import type { DynamicModule } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { AuthService } from './auth.service.js';
import { LiveController } from './live.controller.js';
import { LiveService } from './live.service.js';
import { LiveGateway } from './live.gateway.js';
import { RequestRateLimitService } from './request-rate-limit.service.js';
import {
  LIVEFLOW_CONFIGURATION,
  LIVE_REPOSITORY,
  type LiveFlowConfiguration,
} from './server-configuration.js';

@Module({})
export class LiveFlowModule {
  static register(configuration: LiveFlowConfiguration): DynamicModule {
    return {
      module: LiveFlowModule,
      imports: [
        JwtModule.register({
          secret: configuration.jwtSecret,
          signOptions: { expiresIn: '1h' },
        }),
      ],
      controllers: [LiveController],
      providers: [
        {
          provide: LIVEFLOW_CONFIGURATION,
          useValue: configuration,
        },
        {
          provide: LIVE_REPOSITORY,
          useValue: configuration.liveRepository,
        },
        AuthService,
        LiveService,
        LiveGateway,
        RequestRateLimitService,
      ],
    };
  }
}
