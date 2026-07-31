import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { demoSessionResponseSchema, roleSchema, type Role } from '@liveflow/contracts';
import { timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { ApiException } from './api-exception.filter.js';
import {
  LIVEFLOW_CONFIGURATION,
  type DemoAccessToken,
  type LiveFlowConfiguration,
} from './server-configuration.js';

const demoSessionLifetimeSeconds = 60 * 60;

const demoAccessTokenSchema = z.object({
  userId: z.string().min(1),
  role: roleSchema,
});

@Injectable()
export class AuthService {
  constructor(
    @Inject(JwtService) private readonly jwtService: JwtService,
    @Inject(LIVEFLOW_CONFIGURATION) private readonly configuration: LiveFlowConfiguration,
  ) {}

  issueDemoSession(role: Role, userId: string): ReturnType<typeof demoSessionResponseSchema.parse> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + demoSessionLifetimeSeconds * 1000);
    const accessToken = this.jwtService.sign({ userId, role });

    return demoSessionResponseSchema.parse({
      accessToken,
      expiresAt: expiresAt.toISOString(),
      role,
    });
  }

  ensureDemoMode(): void {
    if (!this.configuration.demoMode) {
      throw new ApiException(404, 'NOT_FOUND', '지원하지 않는 경로입니다.');
    }
  }

  requireAdminPassword(candidate: string): void {
    const expectedPassword = this.configuration.demoAdminPassword;

    if (!expectedPassword || !isMatchingPassword(candidate, expectedPassword)) {
      throw new ApiException(401, 'INVALID_CREDENTIALS', '관리자 비밀번호가 올바르지 않습니다.');
    }
  }

  requireSession(authorization: string | undefined, message: string): DemoAccessToken {
    const accessToken = getBearerToken(authorization);
    const session = accessToken ? this.verifyAccessToken(accessToken) : null;

    if (!session) {
      throw new ApiException(401, 'UNAUTHENTICATED', message);
    }

    return session;
  }

  requireAdmin(authorization: string | undefined): DemoAccessToken {
    const session = this.requireSession(authorization, '관리자 세션이 필요합니다.');

    if (session.role !== 'ADMIN') {
      throw new ApiException(403, 'FORBIDDEN', '관리자 권한이 필요합니다.');
    }

    return session;
  }

  verifySocketToken(value: unknown): DemoAccessToken | null {
    return typeof value === 'string' ? this.verifyAccessToken(value) : null;
  }

  private verifyAccessToken(accessToken: string): DemoAccessToken | null {
    try {
      const decodedToken = this.jwtService.verify<Record<string, unknown>>(accessToken);
      const parsedToken = demoAccessTokenSchema.safeParse(decodedToken);
      return parsedToken.success ? parsedToken.data : null;
    } catch {
      return null;
    }
  }
}

function getBearerToken(authorization: string | undefined): string | null {
  if (!authorization?.startsWith('Bearer ')) {
    return null;
  }

  const accessToken = authorization.slice('Bearer '.length).trim();
  return accessToken.length > 0 ? accessToken : null;
}

function isMatchingPassword(candidate: string, expected: string): boolean {
  const candidateBuffer = Buffer.from(candidate);
  const expectedBuffer = Buffer.from(expected);

  return (
    candidateBuffer.length === expectedBuffer.length &&
    timingSafeEqual(candidateBuffer, expectedBuffer)
  );
}
