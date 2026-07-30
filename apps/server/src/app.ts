import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import {
  chatMessagePageSchema,
  chatMessagesQuerySchema,
  chatMessageSchema,
  createChatMessageRequestSchema,
  demoAdminSessionRequestSchema,
  demoSessionResponseSchema,
  featureProductRequestSchema,
  healthResponseSchema,
  liveJoinRequestSchema,
  liveParamsSchema,
  liveSnapshotSchema,
  type ProductFeaturedEvent,
  type RealtimeEvent,
  type Role,
} from '@liveflow/contracts';
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';
import { timingSafeEqual } from 'node:crypto';
import { Server as SocketIOServer, type Socket } from 'socket.io';
import { prismaLiveRepository, type LiveRepository } from './live-repository.js';

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: DemoAccessToken;
    user: DemoAccessToken;
  }
}

const defaultWebOrigin = 'http://localhost:3000';
const demoSessionLifetimeSeconds = 60 * 60;

type DemoAccessToken = {
  userId: string;
  role: Role;
};

type ServerToClientEvents = {
  'live.event': (event: RealtimeEvent) => void;
};

type ClientToServerEvents = {
  'live.join': (
    input: unknown,
    acknowledge: (result: { ok: boolean; lastEventSequence?: number }) => void,
  ) => void;
};

type SocketData = {
  session: DemoAccessToken;
};

export interface BuildServerOptions {
  demoAdminPassword?: string;
  demoMode?: boolean;
  jwtSecret?: string;
  liveRepository?: LiveRepository;
  publishRealtimeEvent?: (event: RealtimeEvent) => void;
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

function isDemoMode(options: BuildServerOptions): boolean {
  return options.demoMode ?? process.env.DEMO_MODE !== 'false';
}

function isMatchingPassword(candidate: string, expected: string): boolean {
  const candidateBuffer = Buffer.from(candidate);
  const expectedBuffer = Buffer.from(expected);

  return (
    candidateBuffer.length === expectedBuffer.length &&
    timingSafeEqual(candidateBuffer, expectedBuffer)
  );
}

function sendApiError(
  request: FastifyRequest,
  reply: FastifyReply,
  statusCode: number,
  code: string,
  message: string,
): FastifyReply {
  return reply.status(statusCode).send({
    code,
    message,
    requestId: request.id,
  });
}

async function requireAdmin(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<DemoAccessToken | null> {
  const session = await requireSession(request, reply, '관리자 세션이 필요합니다.');

  if (!session) {
    return null;
  }

  if (session.role !== 'ADMIN') {
    sendApiError(request, reply, 403, 'FORBIDDEN', '관리자 권한이 필요합니다.');
    return null;
  }

  return session;
}

async function requireSession(
  request: FastifyRequest,
  reply: FastifyReply,
  message: string,
): Promise<DemoAccessToken | null> {
  try {
    await request.jwtVerify();
  } catch {
    sendApiError(request, reply, 401, 'UNAUTHENTICATED', message);
    return null;
  }

  return request.user;
}

function toPublicRoom(liveId: string): string {
  return `live:${liveId}:public`;
}

function toAdminRoom(liveId: string): string {
  return `live:${liveId}:admin`;
}

function issueDemoSession(
  app: FastifyInstance,
  role: Role,
  userId: string,
): ReturnType<typeof demoSessionResponseSchema.parse> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + demoSessionLifetimeSeconds * 1000);
  const accessToken = app.jwt.sign({ userId, role }, { expiresIn: demoSessionLifetimeSeconds });

  return demoSessionResponseSchema.parse({
    accessToken,
    expiresAt: expiresAt.toISOString(),
    role,
  });
}

export async function buildServer(options: BuildServerOptions = {}): Promise<FastifyInstance> {
  const allowedOrigins = getWebOrigins();
  const liveRepository = options.liveRepository ?? prismaLiveRepository;
  const app = Fastify({ logger: true });
  const io = new SocketIOServer<
    ClientToServerEvents,
    ServerToClientEvents,
    Record<string, never>,
    SocketData
  >(app.server, {
    cors: {
      origin: allowedOrigins,
    },
  });
  const publishRealtimeEvent =
    options.publishRealtimeEvent ??
    ((event: RealtimeEvent) => {
      io.to(toPublicRoom(event.liveId)).emit('live.event', event);
    });

  await app.register(cors, {
    origin: allowedOrigins,
  });
  await app.register(jwt, {
    secret: getJwtSecret(options),
  });
  await app.register(rateLimit, {
    global: false,
  });

  io.use(async (socket, next) => {
    const accessToken = socket.handshake.auth.token;

    if (typeof accessToken !== 'string') {
      next(new Error('UNAUTHENTICATED'));
      return;
    }

    try {
      socket.data.session = await app.jwt.verify<DemoAccessToken>(accessToken);
      next();
    } catch {
      next(new Error('UNAUTHENTICATED'));
    }
  });

  io.on(
    'connection',
    (
      socket: Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>,
    ) => {
      socket.on('live.join', async (input, acknowledge) => {
        const parsedInput = liveJoinRequestSchema.safeParse(input);

        if (!parsedInput.success) {
          acknowledge({ ok: false });
          return;
        }

        const snapshot = await liveRepository.getSnapshot(parsedInput.data.liveId);

        if (!snapshot) {
          acknowledge({ ok: false });
          return;
        }

        await socket.join(toPublicRoom(parsedInput.data.liveId));
        if (socket.data.session.role === 'ADMIN') {
          await socket.join(toAdminRoom(parsedInput.data.liveId));
        }

        acknowledge({
          ok: true,
          lastEventSequence: snapshot.lastEventSequence,
        });
      });
    },
  );

  app.get('/health', async (request) =>
    healthResponseSchema.parse({
      status: 'ok',
      service: 'liveflow-server',
      requestId: request.id,
      timestamp: new Date().toISOString(),
    }),
  );

  app.post('/api/v1/demo/viewer-session', async (request, reply) => {
    if (!isDemoMode(options)) {
      return sendApiError(request, reply, 404, 'NOT_FOUND', '지원하지 않는 경로입니다.');
    }

    return issueDemoSession(app, 'VIEWER', 'demo-viewer');
  });

  app.post(
    '/api/v1/demo/admin-session',
    {
      config: {
        rateLimit: {
          max: 5,
          timeWindow: '1 minute',
        },
      },
    },
    async (request, reply) => {
      if (!isDemoMode(options)) {
        return sendApiError(request, reply, 404, 'NOT_FOUND', '지원하지 않는 경로입니다.');
      }

      const parsedBody = demoAdminSessionRequestSchema.safeParse(request.body);
      if (!parsedBody.success) {
        return sendApiError(request, reply, 400, 'VALIDATION_ERROR', '비밀번호를 입력해 주세요.');
      }

      const expectedPassword = options.demoAdminPassword ?? process.env.DEMO_ADMIN_PASSWORD;
      if (!expectedPassword || !isMatchingPassword(parsedBody.data.password, expectedPassword)) {
        return sendApiError(
          request,
          reply,
          401,
          'INVALID_CREDENTIALS',
          '관리자 비밀번호가 올바르지 않습니다.',
        );
      }

      return issueDemoSession(app, 'ADMIN', 'demo-admin');
    },
  );

  app.get('/api/v1/lives/:liveId/snapshot', async (request, reply) => {
    const parsedParams = liveParamsSchema.safeParse(request.params);
    if (!parsedParams.success) {
      return sendApiError(request, reply, 400, 'VALIDATION_ERROR', '방송 ID가 올바르지 않습니다.');
    }

    const snapshot = await liveRepository.getSnapshot(parsedParams.data.liveId);
    if (!snapshot) {
      return sendApiError(request, reply, 404, 'LIVE_NOT_FOUND', '방송을 찾을 수 없습니다.');
    }

    return liveSnapshotSchema.parse(snapshot);
  });

  app.get('/api/v1/lives/:liveId/messages', async (request, reply) => {
    const parsedParams = liveParamsSchema.safeParse(request.params);
    if (!parsedParams.success) {
      return sendApiError(request, reply, 400, 'VALIDATION_ERROR', '방송 ID가 올바르지 않습니다.');
    }

    const parsedQuery = chatMessagesQuerySchema.safeParse(request.query);
    if (!parsedQuery.success) {
      return sendApiError(
        request,
        reply,
        400,
        'VALIDATION_ERROR',
        '메시지 조회 조건이 올바르지 않습니다.',
      );
    }

    const page = await liveRepository.getMessages(parsedParams.data.liveId, parsedQuery.data);
    if (!page) {
      return sendApiError(request, reply, 404, 'LIVE_NOT_FOUND', '방송을 찾을 수 없습니다.');
    }

    return chatMessagePageSchema.parse(page);
  });

  app.post(
    '/api/v1/lives/:liveId/messages',
    {
      config: {
        rateLimit: {
          max: 10,
          timeWindow: '10 seconds',
        },
      },
    },
    async (request, reply) => {
      const session = await requireSession(request, reply, '채팅 세션이 필요합니다.');
      if (!session) {
        return reply;
      }

      const parsedParams = liveParamsSchema.safeParse(request.params);
      if (!parsedParams.success) {
        return sendApiError(
          request,
          reply,
          400,
          'VALIDATION_ERROR',
          '방송 ID가 올바르지 않습니다.',
        );
      }

      const parsedBody = createChatMessageRequestSchema.safeParse(request.body);
      if (!parsedBody.success) {
        return sendApiError(
          request,
          reply,
          400,
          'VALIDATION_ERROR',
          '메시지 내용을 확인해 주세요.',
        );
      }

      const result = await liveRepository.createMessage({
        liveId: parsedParams.data.liveId,
        senderId: session.userId,
        senderRole: session.role,
        clientMessageId: parsedBody.data.clientMessageId,
        content: parsedBody.data.content,
      });

      if (result.kind === 'live_not_found') {
        return sendApiError(request, reply, 404, 'LIVE_NOT_FOUND', '방송을 찾을 수 없습니다.');
      }

      if (result.kind === 'live_not_accepting_chat') {
        return sendApiError(
          request,
          reply,
          409,
          'LIVE_NOT_ACCEPTING_CHAT',
          '현재 방송에서는 채팅을 보낼 수 없습니다.',
        );
      }

      if (result.kind === 'created') {
        publishRealtimeEvent(result.event);
        return chatMessageSchema.parse(result.event.payload.message);
      }

      return chatMessageSchema.parse(result.message);
    },
  );

  app.put('/api/v1/admin/lives/:liveId/featured-product', async (request, reply) => {
    const session = await requireAdmin(request, reply);
    if (!session) {
      return reply;
    }

    const parsedParams = liveParamsSchema.safeParse(request.params);
    if (!parsedParams.success) {
      return sendApiError(request, reply, 400, 'VALIDATION_ERROR', '방송 ID가 올바르지 않습니다.');
    }

    const parsedBody = featureProductRequestSchema.safeParse(request.body);
    if (!parsedBody.success) {
      return sendApiError(request, reply, 400, 'VALIDATION_ERROR', '상품 ID가 올바르지 않습니다.');
    }

    const result = await liveRepository.featureProduct({
      liveId: parsedParams.data.liveId,
      productId: parsedBody.data.productId,
      actorId: session.userId,
    });

    if (result.kind === 'live_not_found') {
      return sendApiError(request, reply, 404, 'LIVE_NOT_FOUND', '방송을 찾을 수 없습니다.');
    }

    if (result.kind === 'product_not_found') {
      return sendApiError(request, reply, 404, 'PRODUCT_NOT_FOUND', '상품을 찾을 수 없습니다.');
    }

    publishRealtimeEvent(result.event);
    return result.event;
  });

  app.addHook('onClose', async () => {
    await io.close();
  });

  return app;
}

export function isProductFeaturedEvent(event: RealtimeEvent): event is ProductFeaturedEvent {
  return event.type === 'product.featured';
}
