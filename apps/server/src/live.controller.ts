import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import {
  adminLiveListQuerySchema,
  adminLiveListSchema,
  adminLiveSessionSchema,
  adminOrderPageSchema,
  adminOrdersQuerySchema,
  aiSuggestionListSchema,
  aiSuggestionParamsSchema,
  aiSuggestionSchema,
  aiProductAnswerEvaluationReportSchema,
  announcementPublishedEventSchema,
  auditLogPageSchema,
  auditLogsQuerySchema,
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
  createLiveDraftRequestSchema,
  demoAdminSessionRequestSchema,
  featureProductRequestSchema,
  healthResponseSchema,
  hideChatMessageRequestSchema,
  liveParamsSchema,
  liveMetricsSchema,
  liveStatusChangedEventSchema,
  liveSnapshotSchema,
  couponPublishedEventSchema,
  couponRedeemedEventSchema,
  createAiChatSummaryRequestSchema,
  aiProductAnswerSchema,
  createProductQuestionRequestSchema,
  createOrderRequestSchema,
  idempotencyKeySchema,
  inventoryUpdatedEventSchema,
  inventoryLowEventSchema,
  liveProductListSchema,
  liveSessionSchema,
  adminOrderListSchema,
  orderParamsSchema,
  orderSchema,
  orderCreatedEventSchema,
  orderStatusChangedEventSchema,
  ordersQuerySchema,
  publishAnnouncementRequestSchema,
  publishCouponRequestSchema,
  productCatalogSchema,
  replaceLiveProductsRequestSchema,
  reviewAiSuggestionRequestSchema,
  updateLiveDraftRequestSchema,
} from '@liveflow/contracts';
import type { LiveStatusTransitionAction } from '@liveflow/contracts';
import type { FastifyRequest } from 'fastify';

import { AiProviderUnavailableError } from './ai.service.js';
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

  @Get('api/v1/admin/lives')
  async listAdminLives(@Query() query: unknown, @Req() request: FastifyRequest) {
    this.authService.requireAdmin(request.headers.authorization);
    const parsedQuery = adminLiveListQuerySchema.safeParse(query);

    if (!parsedQuery.success) {
      throw new ApiException(400, 'VALIDATION_ERROR', '방송 목록 조회 조건이 올바르지 않습니다.');
    }

    return adminLiveListSchema.parse(await this.liveService.listAdminLives(parsedQuery.data));
  }

  @Get('api/v1/admin/products')
  async listCatalogProducts(@Req() request: FastifyRequest) {
    this.authService.requireAdmin(request.headers.authorization);
    return productCatalogSchema.parse(await this.liveService.listCatalogProducts());
  }

  @Get('api/v1/admin/lives/:liveId')
  async getAdminLive(@Param('liveId') liveId: string, @Req() request: FastifyRequest) {
    this.authService.requireAdmin(request.headers.authorization);
    const parsedParams = liveParamsSchema.safeParse({ liveId });
    if (!parsedParams.success) {
      throw new ApiException(400, 'VALIDATION_ERROR', '방송 ID가 올바르지 않습니다.');
    }

    const live = await this.liveService.getAdminLive(parsedParams.data.liveId);
    if (!live) {
      throw new ApiException(404, 'LIVE_NOT_FOUND', '방송을 찾을 수 없습니다.');
    }

    return adminLiveSessionSchema.parse(live);
  }

  @Get('api/v1/lives/current')
  async getCurrentLive() {
    return liveSessionSchema.nullable().parse(await this.liveService.getCurrentLive());
  }

  @Get('api/v1/admin/lives/:liveId/metrics')
  async getLiveMetrics(@Param('liveId') liveId: string, @Req() request: FastifyRequest) {
    this.authService.requireAdmin(request.headers.authorization);
    const parsedParams = liveParamsSchema.safeParse({ liveId });
    if (!parsedParams.success) {
      throw new ApiException(400, 'VALIDATION_ERROR', '방송 ID가 올바르지 않습니다.');
    }

    const result = await this.liveService.getLiveMetrics(parsedParams.data.liveId);
    if (result.kind === 'live_not_found') {
      throw new ApiException(404, 'LIVE_NOT_FOUND', '방송을 찾을 수 없습니다.');
    }

    return liveMetricsSchema.parse(result.metrics);
  }

  @Get('api/v1/admin/lives/:liveId/products')
  async getLiveProducts(@Param('liveId') liveId: string, @Req() request: FastifyRequest) {
    this.authService.requireAdmin(request.headers.authorization);
    const parsedParams = liveParamsSchema.safeParse({ liveId });
    if (!parsedParams.success) {
      throw new ApiException(400, 'VALIDATION_ERROR', '방송 ID가 올바르지 않습니다.');
    }

    const result = await this.liveService.getLiveProducts(parsedParams.data.liveId);
    if (result.kind === 'live_not_found') {
      throw new ApiException(404, 'LIVE_NOT_FOUND', '방송을 찾을 수 없습니다.');
    }

    return liveProductListSchema.parse(result.products);
  }

  @Put('api/v1/admin/lives/:liveId/products')
  async replaceLiveProducts(
    @Param('liveId') liveId: string,
    @Body() body: unknown,
    @Req() request: FastifyRequest,
  ) {
    const session = this.authService.requireAdmin(request.headers.authorization);
    this.consumeRateLimit(request, 'live-products-replace', 20, 60_000);
    const parsedParams = liveParamsSchema.safeParse({ liveId });
    if (!parsedParams.success) {
      throw new ApiException(400, 'VALIDATION_ERROR', '방송 ID가 올바르지 않습니다.');
    }

    const parsedBody = replaceLiveProductsRequestSchema.safeParse(body);
    if (!parsedBody.success) {
      throw new ApiException(400, 'VALIDATION_ERROR', '방송 상품 목록이 올바르지 않습니다.');
    }

    const result = await this.liveService.replaceLiveProducts({
      actorId: session.userId,
      liveId: parsedParams.data.liveId,
      productIds: parsedBody.data.productIds,
    });
    if (result.kind === 'live_not_found') {
      throw new ApiException(404, 'LIVE_NOT_FOUND', '방송을 찾을 수 없습니다.');
    }

    if (result.kind === 'live_not_editable') {
      throw new ApiException(
        409,
        'LIVE_PRODUCTS_NOT_EDITABLE',
        '초안 또는 방송 예정 상태에서만 판매 상품을 변경할 수 있습니다.',
      );
    }

    if (result.kind === 'products_not_found') {
      throw new ApiException(404, 'PRODUCT_NOT_FOUND', '상품 catalog에서 상품을 찾을 수 없습니다.');
    }

    if (result.kind === 'product_not_sellable') {
      throw new ApiException(
        409,
        'PRODUCT_NOT_SELLABLE',
        '옵션 재고가 남아 있는 상품만 방송에 추가할 수 있습니다.',
      );
    }

    if (result.featuredProductEvent) {
      this.liveGateway.publish(result.featuredProductEvent);
    }

    return liveProductListSchema.parse(result.products);
  }

  @Post('api/v1/admin/lives')
  @HttpCode(HttpStatus.CREATED)
  async createLiveDraft(@Body() body: unknown, @Req() request: FastifyRequest) {
    const session = this.authService.requireAdmin(request.headers.authorization);
    this.consumeRateLimit(request, 'live-draft-create', 10, 60_000);
    const parsedBody = createLiveDraftRequestSchema.safeParse(body);

    if (!parsedBody.success) {
      throw new ApiException(400, 'VALIDATION_ERROR', '방송 초안 정보를 확인해 주세요.');
    }

    if (!isFutureScheduledStart(parsedBody.data.scheduledStartAt)) {
      throw new ApiException(
        400,
        'LIVE_SCHEDULED_START_INVALID',
        '예정 시작 시각은 현재 시각 이후로 설정해 주세요.',
      );
    }

    const live = await this.liveService.createLiveDraft({
      actorId: session.userId,
      draft: parsedBody.data,
    });

    return adminLiveSessionSchema.parse(live);
  }

  @Patch('api/v1/admin/lives/:liveId')
  async updateLiveDraft(
    @Param('liveId') liveId: string,
    @Body() body: unknown,
    @Req() request: FastifyRequest,
  ) {
    const session = this.authService.requireAdmin(request.headers.authorization);
    this.consumeRateLimit(request, 'live-draft-update', 20, 60_000);
    const parsedParams = liveParamsSchema.safeParse({ liveId });
    if (!parsedParams.success) {
      throw new ApiException(400, 'VALIDATION_ERROR', '방송 ID가 올바르지 않습니다.');
    }

    const parsedBody = updateLiveDraftRequestSchema.safeParse(body);
    if (!parsedBody.success) {
      throw new ApiException(400, 'VALIDATION_ERROR', '방송 초안 정보를 확인해 주세요.');
    }

    if (!isFutureScheduledStart(parsedBody.data.scheduledStartAt)) {
      throw new ApiException(
        400,
        'LIVE_SCHEDULED_START_INVALID',
        '예정 시작 시각은 현재 시각 이후로 설정해 주세요.',
      );
    }

    const result = await this.liveService.updateLiveDraft({
      actorId: session.userId,
      draft: parsedBody.data,
      liveId: parsedParams.data.liveId,
    });
    if (result.kind === 'live_not_found') {
      throw new ApiException(404, 'LIVE_NOT_FOUND', '방송을 찾을 수 없습니다.');
    }

    if (result.kind === 'live_not_editable') {
      throw new ApiException(
        409,
        'LIVE_NOT_EDITABLE',
        '초안 또는 방송 예정 상태의 방송만 수정할 수 있습니다.',
      );
    }

    return adminLiveSessionSchema.parse(result.live);
  }

  @Post('api/v1/admin/lives/:liveId/cancel')
  @HttpCode(HttpStatus.OK)
  async cancelLiveDraft(@Param('liveId') liveId: string, @Req() request: FastifyRequest) {
    const session = this.authService.requireAdmin(request.headers.authorization);
    this.consumeRateLimit(request, 'live-draft-cancel', 10, 60_000);
    const parsedParams = liveParamsSchema.safeParse({ liveId });
    if (!parsedParams.success) {
      throw new ApiException(400, 'VALIDATION_ERROR', '방송 ID가 올바르지 않습니다.');
    }

    const result = await this.liveService.cancelLiveDraft({
      actorId: session.userId,
      liveId: parsedParams.data.liveId,
    });
    if (result.kind === 'live_not_found') {
      throw new ApiException(404, 'LIVE_NOT_FOUND', '방송을 찾을 수 없습니다.');
    }

    if (result.kind === 'live_not_cancellable') {
      throw new ApiException(
        409,
        'LIVE_NOT_CANCELLABLE',
        '시작 전 상태의 방송만 취소할 수 있습니다.',
      );
    }

    return adminLiveSessionSchema.parse(result.live);
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

  @Post('api/v1/lives/:liveId/ai/product-questions')
  @HttpCode(HttpStatus.OK)
  async answerProductQuestion(
    @Param('liveId') liveId: string,
    @Body() body: unknown,
    @Req() request: FastifyRequest,
  ) {
    const session = this.authService.requireSession(
      request.headers.authorization,
      '상품 질문을 위해 시청자 세션이 필요합니다.',
    );

    if (session.role !== 'VIEWER') {
      throw new ApiException(403, 'FORBIDDEN', '시청자 세션으로만 상품 질문을 보낼 수 있습니다.');
    }

    this.consumeRateLimit(request, 'product-question', 10, 60_000);
    const parsedParams = liveParamsSchema.safeParse({ liveId });
    if (!parsedParams.success) {
      throw new ApiException(400, 'VALIDATION_ERROR', '방송 ID가 올바르지 않습니다.');
    }

    const parsedBody = createProductQuestionRequestSchema.safeParse(body);
    if (!parsedBody.success) {
      throw new ApiException(400, 'VALIDATION_ERROR', '상품 질문을 확인해 주세요.');
    }

    try {
      const result = await this.liveService.answerProductQuestion(
        parsedParams.data.liveId,
        parsedBody.data.question,
      );

      if (result.kind === 'live_not_found') {
        throw new ApiException(404, 'LIVE_NOT_FOUND', '방송을 찾을 수 없습니다.');
      }

      if (result.kind === 'featured_product_not_found') {
        throw new ApiException(
          409,
          'FEATURED_PRODUCT_REQUIRED',
          '현재 소개 중인 상품이 없어 질문에 답할 수 없습니다.',
        );
      }

      return aiProductAnswerSchema.parse(result.answer);
    } catch (error: unknown) {
      if (error instanceof AiProviderUnavailableError) {
        throw new ApiException(
          503,
          'AI_PROVIDER_UNAVAILABLE',
          'AI 답변을 준비하지 못했습니다. 잠시 후 다시 시도해 주세요.',
        );
      }

      throw error;
    }
  }

  @Get('api/v1/admin/lives/:liveId/ai/suggestions')
  async getAiSuggestions(@Param('liveId') liveId: string, @Req() request: FastifyRequest) {
    this.authService.requireAdmin(request.headers.authorization);
    const parsedParams = liveParamsSchema.safeParse({ liveId });
    if (!parsedParams.success) {
      throw new ApiException(400, 'VALIDATION_ERROR', '방송 ID가 올바르지 않습니다.');
    }

    const result = await this.liveService.getAiSuggestions(parsedParams.data.liveId);
    if (result.kind === 'live_not_found') {
      throw new ApiException(404, 'LIVE_NOT_FOUND', '방송을 찾을 수 없습니다.');
    }

    return aiSuggestionListSchema.parse(result.suggestions);
  }

  @Get('api/v1/admin/ai-evals/product-answers')
  getProductAnswerEvaluations(@Req() request: FastifyRequest) {
    this.authService.requireAdmin(request.headers.authorization);
    this.consumeRateLimit(request, 'ai-product-answer-evaluations', 10, 60_000);

    try {
      return aiProductAnswerEvaluationReportSchema.parse(
        this.liveService.evaluateProductAnswerFixtures(),
      );
    } catch (error: unknown) {
      if (error instanceof AiProviderUnavailableError) {
        throw new ApiException(
          503,
          'AI_PROVIDER_UNAVAILABLE',
          'AI 평가 결과를 준비하지 못했습니다. 잠시 후 다시 시도해 주세요.',
        );
      }

      throw error;
    }
  }

  @Get('api/v1/admin/lives/:liveId/audit-logs')
  async getAuditLogs(
    @Param('liveId') liveId: string,
    @Query() query: unknown,
    @Req() request: FastifyRequest,
  ) {
    this.authService.requireAdmin(request.headers.authorization);
    const parsedParams = liveParamsSchema.safeParse({ liveId });
    if (!parsedParams.success) {
      throw new ApiException(400, 'VALIDATION_ERROR', '방송 ID가 올바르지 않습니다.');
    }

    const parsedQuery = auditLogsQuerySchema.safeParse(query);
    if (!parsedQuery.success) {
      throw new ApiException(400, 'VALIDATION_ERROR', '감사 로그 조회 조건이 올바르지 않습니다.');
    }

    const result = await this.liveService.getAuditLogs(parsedParams.data.liveId, parsedQuery.data);
    if (result.kind === 'live_not_found') {
      throw new ApiException(404, 'LIVE_NOT_FOUND', '방송을 찾을 수 없습니다.');
    }

    return auditLogPageSchema.parse(result.page);
  }

  @Post('api/v1/admin/lives/:liveId/ai/chat-summaries')
  @HttpCode(HttpStatus.OK)
  async createChatSummarySuggestion(
    @Param('liveId') liveId: string,
    @Body() body: unknown,
    @Req() request: FastifyRequest,
  ) {
    const session = this.authService.requireAdmin(request.headers.authorization);
    this.consumeRateLimit(request, 'ai-chat-summary', 5, 60_000);
    const parsedParams = liveParamsSchema.safeParse({ liveId });
    if (!parsedParams.success) {
      throw new ApiException(400, 'VALIDATION_ERROR', '방송 ID가 올바르지 않습니다.');
    }

    const parsedBody = createAiChatSummaryRequestSchema.safeParse(body);
    if (!parsedBody.success) {
      throw new ApiException(400, 'VALIDATION_ERROR', '분석할 메시지 수를 확인해 주세요.');
    }

    try {
      const result = await this.liveService.createChatSummarySuggestion({
        actorId: session.userId,
        liveId: parsedParams.data.liveId,
        maxMessages: parsedBody.data.maxMessages,
      });

      if (result.kind === 'live_not_found') {
        throw new ApiException(404, 'LIVE_NOT_FOUND', '방송을 찾을 수 없습니다.');
      }

      if (result.kind === 'no_chat_messages') {
        throw new ApiException(409, 'CHAT_MESSAGES_REQUIRED', '요약할 최근 채팅이 없습니다.');
      }

      this.liveGateway.publishToAdmins(result.event);
      return aiSuggestionSchema.parse(result.suggestion);
    } catch (error: unknown) {
      if (error instanceof AiProviderUnavailableError) {
        throw new ApiException(
          503,
          'AI_PROVIDER_UNAVAILABLE',
          'AI 요약을 준비하지 못했습니다. 잠시 후 다시 시도해 주세요.',
        );
      }

      throw error;
    }
  }

  @Patch('api/v1/admin/ai/suggestions/:suggestionId')
  async reviewAiSuggestion(
    @Param('suggestionId') suggestionId: string,
    @Body() body: unknown,
    @Req() request: FastifyRequest,
  ) {
    const session = this.authService.requireAdmin(request.headers.authorization);
    this.consumeRateLimit(request, 'ai-suggestion-review', 10, 60_000);
    const parsedParams = aiSuggestionParamsSchema.safeParse({ suggestionId });
    if (!parsedParams.success) {
      throw new ApiException(400, 'VALIDATION_ERROR', 'AI 제안 ID가 올바르지 않습니다.');
    }

    const parsedBody = reviewAiSuggestionRequestSchema.safeParse(body);
    if (!parsedBody.success) {
      throw new ApiException(400, 'VALIDATION_ERROR', 'AI 제안 검토 내용을 확인해 주세요.');
    }

    const result = await this.liveService.reviewAiSuggestion({
      actorId: session.userId,
      suggestionId: parsedParams.data.suggestionId,
      ...parsedBody.data,
    });

    if (result.kind === 'suggestion_not_found') {
      throw new ApiException(404, 'AI_SUGGESTION_NOT_FOUND', 'AI 제안을 찾을 수 없습니다.');
    }

    if (result.kind === 'suggestion_not_reviewable') {
      throw new ApiException(
        409,
        'AI_SUGGESTION_NOT_REVIEWABLE',
        '이미 검토가 끝난 AI 제안입니다.',
      );
    }

    if (result.kind === 'approved') {
      this.liveGateway.publish(announcementPublishedEventSchema.parse(result.event));
    }

    return aiSuggestionSchema.parse(result.suggestion);
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
      this.liveGateway.publishToAdmins(orderCreatedEventSchema.parse(result.adminOrderEvent));
      if (result.inventoryLowEvent) {
        this.liveGateway.publishToAdmins(inventoryLowEventSchema.parse(result.inventoryLowEvent));
      }
    }

    return orderSchema.parse(result.order);
  }

  @Get('api/v1/orders/:orderId')
  async getViewerOrder(@Param('orderId') orderId: string, @Req() request: FastifyRequest) {
    const session = this.authService.requireSession(
      request.headers.authorization,
      '주문 결과를 확인하려면 시청자 세션이 필요합니다.',
    );

    if (session.role !== 'VIEWER') {
      throw new ApiException(403, 'FORBIDDEN', '시청자 세션으로만 주문 결과를 확인할 수 있습니다.');
    }

    const parsedParams = orderParamsSchema.safeParse({ orderId });
    if (!parsedParams.success) {
      throw new ApiException(400, 'VALIDATION_ERROR', '주문 ID가 올바르지 않습니다.');
    }

    const result = await this.liveService.getViewerOrder({
      orderId: parsedParams.data.orderId,
      userId: session.userId,
    });
    if (result.kind === 'order_not_found') {
      throw new ApiException(404, 'ORDER_NOT_FOUND', '주문을 찾을 수 없습니다.');
    }

    return orderSchema.parse(result.order);
  }

  @Get('api/v1/admin/orders')
  async listAdminOrders(@Query() query: unknown, @Req() request: FastifyRequest) {
    this.authService.requireAdmin(request.headers.authorization);
    const parsedQuery = adminOrdersQuerySchema.safeParse(query);
    if (!parsedQuery.success) {
      throw new ApiException(400, 'VALIDATION_ERROR', '주문 목록 조회 조건이 올바르지 않습니다.');
    }

    const result = await this.liveService.listAdminOrders(parsedQuery.data);
    if (result.kind === 'live_not_found') {
      throw new ApiException(404, 'LIVE_NOT_FOUND', '방송을 찾을 수 없습니다.');
    }

    return adminOrderPageSchema.parse(result.page);
  }

  @Get('api/v1/admin/lives/:liveId/orders')
  async getRecentOrders(
    @Param('liveId') liveId: string,
    @Query() query: unknown,
    @Req() request: FastifyRequest,
  ) {
    this.authService.requireAdmin(request.headers.authorization);
    const parsedParams = liveParamsSchema.safeParse({ liveId });
    if (!parsedParams.success) {
      throw new ApiException(400, 'VALIDATION_ERROR', '방송 ID가 올바르지 않습니다.');
    }

    const parsedQuery = ordersQuerySchema.safeParse(query);
    if (!parsedQuery.success) {
      throw new ApiException(400, 'VALIDATION_ERROR', '주문 조회 조건이 올바르지 않습니다.');
    }

    const result = await this.liveService.getRecentOrders(
      parsedParams.data.liveId,
      parsedQuery.data,
    );
    if (result.kind === 'live_not_found') {
      throw new ApiException(404, 'LIVE_NOT_FOUND', '방송을 찾을 수 없습니다.');
    }

    return adminOrderListSchema.parse(result.orders);
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

  @Post('api/v1/admin/lives/:liveId/announcements')
  async publishAnnouncement(
    @Param('liveId') liveId: string,
    @Body() body: unknown,
    @Req() request: FastifyRequest,
  ) {
    const session = this.authService.requireAdmin(request.headers.authorization);
    this.consumeRateLimit(request, 'announcement-publish', 10, 60_000);
    const parsedParams = liveParamsSchema.safeParse({ liveId });
    if (!parsedParams.success) {
      throw new ApiException(400, 'VALIDATION_ERROR', '방송 ID가 올바르지 않습니다.');
    }

    const parsedBody = publishAnnouncementRequestSchema.safeParse(body);
    if (!parsedBody.success) {
      throw new ApiException(400, 'VALIDATION_ERROR', '공지 내용을 두 글자 이상 입력해 주세요.');
    }

    const result = await this.liveService.publishAnnouncement({
      liveId: parsedParams.data.liveId,
      actorId: session.userId,
      content: parsedBody.data.content,
    });
    if (result.kind === 'live_not_found') {
      throw new ApiException(404, 'LIVE_NOT_FOUND', '방송을 찾을 수 없습니다.');
    }

    this.liveGateway.publish(result.event);
    return announcementPublishedEventSchema.parse(result.event);
  }

  @Post('api/v1/admin/lives/:liveId/start')
  @HttpCode(HttpStatus.OK)
  async startLive(@Param('liveId') liveId: string, @Req() request: FastifyRequest) {
    return this.changeLiveStatus(liveId, request, 'START');
  }

  @Post('api/v1/admin/lives/:liveId/schedule')
  @HttpCode(HttpStatus.OK)
  async scheduleLive(@Param('liveId') liveId: string, @Req() request: FastifyRequest) {
    return this.changeLiveStatus(liveId, request, 'SCHEDULE');
  }

  @Post('api/v1/admin/lives/:liveId/prepare')
  @HttpCode(HttpStatus.OK)
  async prepareLive(@Param('liveId') liveId: string, @Req() request: FastifyRequest) {
    return this.changeLiveStatus(liveId, request, 'PREPARE');
  }

  @Post('api/v1/admin/lives/:liveId/next-session')
  @HttpCode(HttpStatus.CREATED)
  async createNextLiveSession(@Param('liveId') liveId: string, @Req() request: FastifyRequest) {
    const session = this.authService.requireAdmin(request.headers.authorization);
    this.consumeRateLimit(request, 'live-session-create', 5, 60_000);
    const parsedParams = liveParamsSchema.safeParse({ liveId });
    if (!parsedParams.success) {
      throw new ApiException(400, 'VALIDATION_ERROR', '방송 ID가 올바르지 않습니다.');
    }

    const result = await this.liveService.createNextLiveSession({
      actorId: session.userId,
      sourceLiveId: parsedParams.data.liveId,
    });
    if (result.kind === 'live_not_found') {
      throw new ApiException(404, 'LIVE_NOT_FOUND', '방송을 찾을 수 없습니다.');
    }

    if (result.kind === 'source_live_not_ended') {
      throw new ApiException(
        409,
        'NEXT_LIVE_SESSION_REQUIRES_ENDED_SOURCE',
        '새 방송은 종료된 방송에서만 만들 수 있습니다.',
      );
    }

    return liveSessionSchema.parse(result.live);
  }

  @Post('api/v1/admin/lives/:liveId/end')
  @HttpCode(HttpStatus.OK)
  async endLive(@Param('liveId') liveId: string, @Req() request: FastifyRequest) {
    return this.changeLiveStatus(liveId, request, 'END');
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

    if (result.kind === 'product_not_available') {
      throw new ApiException(
        409,
        'PRODUCT_NOT_AVAILABLE',
        '방송에 준비된 상품만 현재 소개 상품으로 선택할 수 있습니다.',
      );
    }

    this.liveGateway.publish(result.event);
    return result.event;
  }

  private async changeLiveStatus(
    liveId: string,
    request: FastifyRequest,
    action: LiveStatusTransitionAction,
  ) {
    const session = this.authService.requireAdmin(request.headers.authorization);
    this.consumeRateLimit(request, 'live-status-change', 10, 60_000);
    const parsedParams = liveParamsSchema.safeParse({ liveId });
    if (!parsedParams.success) {
      throw new ApiException(400, 'VALIDATION_ERROR', '방송 ID가 올바르지 않습니다.');
    }

    const result = await this.liveService.changeLiveStatus({
      liveId: parsedParams.data.liveId,
      actorId: session.userId,
      action,
    });

    if (result.kind === 'live_not_found') {
      throw new ApiException(404, 'LIVE_NOT_FOUND', '방송을 찾을 수 없습니다.');
    }

    if (result.kind === 'invalid_status_transition') {
      throw new ApiException(
        409,
        'LIVE_STATUS_TRANSITION_INVALID',
        getInvalidStatusTransitionMessage(action),
      );
    }

    if (result.kind === 'schedule_requirements_not_met') {
      throw new ApiException(
        409,
        'LIVE_SCHEDULE_REQUIREMENTS_NOT_MET',
        '예정 시작 시각과 판매 상품을 설정한 초안만 방송 예정으로 전환할 수 있습니다.',
      );
    }

    if (result.kind === 'preparation_requirements_not_met') {
      throw new ApiException(
        409,
        'LIVE_PREPARATION_REQUIREMENTS_NOT_MET',
        '옵션 재고가 남아 있는 판매 상품을 준비한 뒤 방송 준비를 완료해 주세요.',
      );
    }

    this.liveGateway.publish(result.event);
    return liveStatusChangedEventSchema.parse(result.event);
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

function isFutureScheduledStart(value: string): boolean {
  return new Date(value).getTime() > Date.now();
}

function getInvalidStatusTransitionMessage(action: LiveStatusTransitionAction): string {
  const messages: Record<LiveStatusTransitionAction, string> = {
    SCHEDULE: '초안 상태의 방송만 방송 예정으로 전환할 수 있습니다.',
    PREPARE: '방송 예정 상태의 방송만 준비 완료로 전환할 수 있습니다.',
    START: '준비 완료 상태의 방송만 시작할 수 있습니다.',
    END: '진행 중인 방송만 종료할 수 있습니다.',
  };

  return messages[action];
}
