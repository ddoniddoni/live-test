import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import {
  chatAccessStatusSchema,
  chatMessagePageSchema,
  chatMessageHiddenEventSchema,
  chatMessageSchema,
  chatMessageParamsSchema,
  chatMessagesQuerySchema,
  chatTimeoutParamsSchema,
  chatTimeoutUserRequestSchema,
  chatUserTimedOutEventSchema,
  createChatMessageRequestSchema,
  demoAdminSessionRequestSchema,
  featureProductRequestSchema,
  healthResponseSchema,
  hideChatMessageRequestSchema,
  liveParamsSchema,
  liveSnapshotSchema,
  couponPublishedEventSchema,
  couponRedeemedEventSchema,
  createOrderRequestSchema,
  idempotencyKeySchema,
  inventoryUpdatedEventSchema,
  orderSchema,
  orderStatusChangedEventSchema,
  publishCouponRequestSchema,
} from '@liveflow/contracts';
import type { FastifyRequest } from 'fastify';

import { ApiException } from './api-exception.filter.js';
import { AuthService } from './auth.service.js';
import { LiveGateway } from './live.gateway.js';
import { LiveService } from './live.service.js';
import { RequestRateLimitService } from './request-rate-limit.service.js';

@Controller()
export class LiveController {
  constructor(
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(LiveGateway) private readonly liveGateway: LiveGateway,
    @Inject(LiveService) private readonly liveService: LiveService,
    @Inject(RequestRateLimitService)
    private readonly requestRateLimitService: RequestRateLimitService,
  ) {}

  @Get('health')
  getHealth(@Req() request: FastifyRequest) {
    return healthResponseSchema.parse({
      status: 'ok',
      service: 'liveflow-server',
      requestId: request.id,
      timestamp: new Date().toISOString(),
    });
  }

  @Post('api/v1/demo/viewer-session')
  @HttpCode(HttpStatus.OK)
  createViewerSession() {
    this.authService.ensureDemoMode();
    return this.authService.issueDemoSession('VIEWER', 'demo-viewer');
  }

  @Post('api/v1/demo/admin-session')
  @HttpCode(HttpStatus.OK)
  createAdminSession(@Body() body: unknown, @Req() request: FastifyRequest) {
    this.authService.ensureDemoMode();
    this.consumeRateLimit(request, 'demo-admin-session', 5, 60_000);
    const parsedBody = demoAdminSessionRequestSchema.safeParse(body);

    if (!parsedBody.success) {
      throw new ApiException(400, 'VALIDATION_ERROR', '비밀번호를 입력해 주세요.');
    }

    this.authService.requireAdminPassword(parsedBody.data.password);
    return this.authService.issueDemoSession('ADMIN', 'demo-admin');
  }

  @Get('api/v1/lives/:liveId/snapshot')
  async getSnapshot(@Param('liveId') liveId: string) {
    const parsedParams = liveParamsSchema.safeParse({ liveId });

    if (!parsedParams.success) {
      throw new ApiException(400, 'VALIDATION_ERROR', '방송 ID가 올바르지 않습니다.');
    }

    const snapshot = await this.liveService.getSnapshot(parsedParams.data.liveId);
    if (!snapshot) {
      throw new ApiException(404, 'LIVE_NOT_FOUND', '방송을 찾을 수 없습니다.');
    }

    return liveSnapshotSchema.parse(snapshot);
  }

  @Get('api/v1/lives/:liveId/messages')
  async getMessages(@Param('liveId') liveId: string, @Query() query: unknown) {
    const parsedParams = liveParamsSchema.safeParse({ liveId });
    if (!parsedParams.success) {
      throw new ApiException(400, 'VALIDATION_ERROR', '방송 ID가 올바르지 않습니다.');
    }

    const parsedQuery = chatMessagesQuerySchema.safeParse(query);
    if (!parsedQuery.success) {
      throw new ApiException(400, 'VALIDATION_ERROR', '메시지 조회 조건이 올바르지 않습니다.');
    }

    const page = await this.liveService.getMessages(parsedParams.data.liveId, parsedQuery.data);
    if (!page) {
      throw new ApiException(404, 'LIVE_NOT_FOUND', '방송을 찾을 수 없습니다.');
    }

    return chatMessagePageSchema.parse(page);
  }

  @Get('api/v1/lives/:liveId/chat-access')
  async getChatAccess(@Param('liveId') liveId: string, @Req() request: FastifyRequest) {
    const session = this.authService.requireSession(
      request.headers.authorization,
      '채팅 세션이 필요합니다.',
    );
    const parsedParams = liveParamsSchema.safeParse({ liveId });
    if (!parsedParams.success) {
      throw new ApiException(400, 'VALIDATION_ERROR', '방송 ID가 올바르지 않습니다.');
    }

    const result = await this.liveService.getChatAccess(parsedParams.data.liveId, session.userId);
    if (result.kind === 'live_not_found') {
      throw new ApiException(404, 'LIVE_NOT_FOUND', '방송을 찾을 수 없습니다.');
    }

    return chatAccessStatusSchema.parse(result.access);
  }

  @Post('api/v1/lives/:liveId/messages')
  @HttpCode(HttpStatus.OK)
  async createMessage(
    @Param('liveId') liveId: string,
    @Body() body: unknown,
    @Req() request: FastifyRequest,
  ) {
    const session = this.authService.requireSession(
      request.headers.authorization,
      '채팅 세션이 필요합니다.',
    );
    this.consumeRateLimit(request, 'chat-message', 10, 10_000);
    const parsedParams = liveParamsSchema.safeParse({ liveId });
    if (!parsedParams.success) {
      throw new ApiException(400, 'VALIDATION_ERROR', '방송 ID가 올바르지 않습니다.');
    }

    const parsedBody = createChatMessageRequestSchema.safeParse(body);
    if (!parsedBody.success) {
      throw new ApiException(400, 'VALIDATION_ERROR', '메시지 내용을 확인해 주세요.');
    }

    const result = await this.liveService.createMessage({
      liveId: parsedParams.data.liveId,
      senderId: session.userId,
      senderRole: session.role,
      clientMessageId: parsedBody.data.clientMessageId,
      content: parsedBody.data.content,
    });

    if (result.kind === 'live_not_found') {
      throw new ApiException(404, 'LIVE_NOT_FOUND', '방송을 찾을 수 없습니다.');
    }

    if (result.kind === 'live_not_accepting_chat') {
      throw new ApiException(
        409,
        'LIVE_NOT_ACCEPTING_CHAT',
        '현재 방송에서는 채팅을 보낼 수 없습니다.',
      );
    }

    if (result.kind === 'user_timed_out') {
      throw new ApiException(
        403,
        'CHAT_TIMEOUT_ACTIVE',
        `채팅 제한이 ${new Date(result.expiresAt).toLocaleTimeString('ko-KR', {
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'Asia/Seoul',
        })}까지 적용되어 있습니다.`,
      );
    }

    if (result.kind === 'created') {
      this.liveGateway.publish(result.event);
      return chatMessageSchema.parse(result.event.payload.message);
    }

    return chatMessageSchema.parse(result.message);
  }

  @Post('api/v1/orders')
  @HttpCode(HttpStatus.OK)
  async createOrder(@Body() body: unknown, @Req() request: FastifyRequest) {
    const session = this.authService.requireSession(
      request.headers.authorization,
      '주문을 위해 시청자 세션이 필요합니다.',
    );

    if (session.role !== 'VIEWER') {
      throw new ApiException(403, 'FORBIDDEN', '시청자 세션으로만 주문할 수 있습니다.');
    }

    this.consumeRateLimit(request, 'mock-order', 10, 60_000);
    const parsedBody = createOrderRequestSchema.safeParse(body);
    if (!parsedBody.success) {
      throw new ApiException(400, 'VALIDATION_ERROR', '주문 상품과 수량을 확인해 주세요.');
    }

    const parsedIdempotencyKey = idempotencyKeySchema.safeParse(request.headers['idempotency-key']);
    if (!parsedIdempotencyKey.success) {
      throw new ApiException(
        400,
        'IDEMPOTENCY_KEY_REQUIRED',
        '유효한 Idempotency-Key 헤더가 필요합니다.',
      );
    }

    const result = await this.liveService.createOrder({
      liveId: parsedBody.data.liveId,
      userId: session.userId,
      productVariantId: parsedBody.data.productVariantId,
      quantity: parsedBody.data.quantity,
      idempotencyKey: parsedIdempotencyKey.data,
    });

    if (result.kind === 'live_not_found') {
      throw new ApiException(404, 'LIVE_NOT_FOUND', '방송을 찾을 수 없습니다.');
    }

    if (result.kind === 'user_not_found') {
      throw new ApiException(401, 'UNAUTHENTICATED', '주문 시청자 정보를 찾을 수 없습니다.');
    }

    if (result.kind === 'live_not_accepting_orders') {
      throw new ApiException(
        409,
        'LIVE_NOT_ACCEPTING_ORDERS',
        '현재 방송에서는 주문할 수 없습니다.',
      );
    }

    if (result.kind === 'product_not_found') {
      throw new ApiException(404, 'PRODUCT_VARIANT_NOT_FOUND', '상품 옵션을 찾을 수 없습니다.');
    }

    if (result.kind === 'product_not_available') {
      throw new ApiException(
        409,
        'PRODUCT_NOT_AVAILABLE',
        '현재 소개 중인 상품만 주문할 수 있습니다.',
      );
    }

    if (result.kind === 'out_of_stock') {
      throw new ApiException(409, 'OUT_OF_STOCK', '선택한 옵션의 재고가 부족합니다.');
    }

    if (result.kind === 'created') {
      this.liveGateway.publish(inventoryUpdatedEventSchema.parse(result.inventoryEvent));
      if (result.couponEvent) {
        this.liveGateway.publish(couponRedeemedEventSchema.parse(result.couponEvent));
      }
      this.liveGateway.publishToUser(
        orderStatusChangedEventSchema.parse(result.orderEvent),
        session.userId,
      );
    }

    return orderSchema.parse(result.order);
  }

  @Put('api/v1/admin/lives/:liveId/messages/:messageId/hide')
  async hideMessage(
    @Param('liveId') liveId: string,
    @Param('messageId') messageId: string,
    @Body() body: unknown,
    @Req() request: FastifyRequest,
  ) {
    const session = this.authService.requireAdmin(request.headers.authorization);
    this.consumeRateLimit(request, 'chat-moderation', 20, 60_000);
    const parsedParams = chatMessageParamsSchema.safeParse({ liveId, messageId });
    if (!parsedParams.success) {
      throw new ApiException(400, 'VALIDATION_ERROR', '방송 또는 메시지 ID가 올바르지 않습니다.');
    }

    const parsedBody = hideChatMessageRequestSchema.safeParse(body);
    if (!parsedBody.success) {
      throw new ApiException(400, 'VALIDATION_ERROR', '숨김 사유를 확인해 주세요.');
    }

    const result = await this.liveService.hideMessage({
      liveId: parsedParams.data.liveId,
      messageId: parsedParams.data.messageId,
      actorId: session.userId,
      reason: parsedBody.data.reason,
    });

    if (result.kind === 'live_not_found') {
      throw new ApiException(404, 'LIVE_NOT_FOUND', '방송을 찾을 수 없습니다.');
    }

    if (result.kind === 'message_not_found') {
      throw new ApiException(404, 'CHAT_MESSAGE_NOT_FOUND', '메시지를 찾을 수 없습니다.');
    }

    if (result.kind === 'already_hidden') {
      throw new ApiException(409, 'CHAT_MESSAGE_ALREADY_HIDDEN', '이미 숨긴 메시지입니다.');
    }

    this.liveGateway.publish(result.event);
    return chatMessageHiddenEventSchema.parse(result.event);
  }

  @Put('api/v1/admin/lives/:liveId/users/:userId/chat-timeout')
  async timeoutUser(
    @Param('liveId') liveId: string,
    @Param('userId') userId: string,
    @Body() body: unknown,
    @Req() request: FastifyRequest,
  ) {
    const session = this.authService.requireAdmin(request.headers.authorization);
    this.consumeRateLimit(request, 'chat-moderation', 20, 60_000);
    const parsedParams = chatTimeoutParamsSchema.safeParse({ liveId, userId });
    if (!parsedParams.success) {
      throw new ApiException(400, 'VALIDATION_ERROR', '방송 또는 사용자 ID가 올바르지 않습니다.');
    }

    const parsedBody = chatTimeoutUserRequestSchema.safeParse(body);
    if (!parsedBody.success) {
      throw new ApiException(400, 'VALIDATION_ERROR', '채팅 제한 시간과 사유를 확인해 주세요.');
    }

    const result = await this.liveService.timeoutUser({
      liveId: parsedParams.data.liveId,
      userId: parsedParams.data.userId,
      actorId: session.userId,
      durationMinutes: parsedBody.data.durationMinutes,
      reason: parsedBody.data.reason,
    });

    if (result.kind === 'live_not_found') {
      throw new ApiException(404, 'LIVE_NOT_FOUND', '방송을 찾을 수 없습니다.');
    }

    if (result.kind === 'user_not_found') {
      throw new ApiException(404, 'CHAT_USER_NOT_FOUND', '사용자를 찾을 수 없습니다.');
    }

    if (result.kind === 'user_not_timeoutable') {
      throw new ApiException(
        409,
        'CHAT_TIMEOUT_TARGET_FORBIDDEN',
        '시청자만 채팅 제한할 수 있습니다.',
      );
    }

    this.liveGateway.publishToUser(result.event, parsedParams.data.userId);
    return chatUserTimedOutEventSchema.parse(result.event);
  }

  @Post('api/v1/admin/lives/:liveId/coupons')
  async publishCoupon(
    @Param('liveId') liveId: string,
    @Body() body: unknown,
    @Req() request: FastifyRequest,
  ) {
    const session = this.authService.requireAdmin(request.headers.authorization);
    this.consumeRateLimit(request, 'coupon-publish', 10, 60_000);
    const parsedParams = liveParamsSchema.safeParse({ liveId });
    if (!parsedParams.success) {
      throw new ApiException(400, 'VALIDATION_ERROR', '방송 ID가 올바르지 않습니다.');
    }

    const parsedBody = publishCouponRequestSchema.safeParse(body);
    if (!parsedBody.success) {
      throw new ApiException(400, 'VALIDATION_ERROR', '쿠폰 조건을 확인해 주세요.');
    }

    const result = await this.liveService.publishCoupon({
      liveId: parsedParams.data.liveId,
      actorId: session.userId,
      type: parsedBody.data.type,
      value: parsedBody.data.value,
      minOrderAmountKrw: parsedBody.data.minOrderAmountKrw,
      endsAt: parsedBody.data.endsAt,
      usageLimit: parsedBody.data.usageLimit,
    });

    if (result.kind === 'live_not_found') {
      throw new ApiException(404, 'LIVE_NOT_FOUND', '방송을 찾을 수 없습니다.');
    }

    if (result.kind === 'coupon_not_publishable') {
      throw new ApiException(409, 'COUPON_NOT_PUBLISHABLE', '만료 시각이 이미 지났습니다.');
    }

    this.liveGateway.publish(result.event);
    return couponPublishedEventSchema.parse(result.event);
  }

  @Put('api/v1/admin/lives/:liveId/featured-product')
  async featureProduct(
    @Param('liveId') liveId: string,
    @Body() body: unknown,
    @Req() request: FastifyRequest,
  ) {
    const session = this.authService.requireAdmin(request.headers.authorization);
    const parsedParams = liveParamsSchema.safeParse({ liveId });
    if (!parsedParams.success) {
      throw new ApiException(400, 'VALIDATION_ERROR', '방송 ID가 올바르지 않습니다.');
    }

    const parsedBody = featureProductRequestSchema.safeParse(body);
    if (!parsedBody.success) {
      throw new ApiException(400, 'VALIDATION_ERROR', '상품 ID가 올바르지 않습니다.');
    }

    const result = await this.liveService.featureProduct({
      liveId: parsedParams.data.liveId,
      productId: parsedBody.data.productId,
      actorId: session.userId,
    });

    if (result.kind === 'live_not_found') {
      throw new ApiException(404, 'LIVE_NOT_FOUND', '방송을 찾을 수 없습니다.');
    }

    if (result.kind === 'product_not_found') {
      throw new ApiException(404, 'PRODUCT_NOT_FOUND', '상품을 찾을 수 없습니다.');
    }

    this.liveGateway.publish(result.event);
    return result.event;
  }

  private consumeRateLimit(
    request: FastifyRequest,
    scope: string,
    limit: number,
    windowMs: number,
  ): void {
    this.requestRateLimitService.consume({
      key: `${scope}:${request.ip}`,
      limit,
      windowMs,
    });
  }
}
