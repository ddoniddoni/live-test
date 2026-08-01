import { Inject, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type {
  ChatMessage,
  ChatMessagesQuery,
  Coupon,
  AuditLogsQuery,
  LiveStatusTransitionAction,
  OrdersQuery,
  ReviewAiSuggestionRequest,
} from '@liveflow/contracts';

import { AiService } from './ai.service.js';
import type { LiveRepository } from './live-repository.js';
import { LIVE_REPOSITORY } from './server-configuration.js';

@Injectable()
export class LiveService {
  constructor(
    @Inject(LIVE_REPOSITORY) private readonly liveRepository: LiveRepository,
    @Inject(AiService) private readonly aiService: AiService,
  ) {}

  getSnapshot(liveId: string) {
    return this.liveRepository.getSnapshot(liveId);
  }

  getMessages(liveId: string, query: ChatMessagesQuery) {
    return this.liveRepository.getMessages(liveId, query);
  }

  getChatAccess(liveId: string, userId: string) {
    return this.liveRepository.getChatAccess(liveId, userId);
  }

  createMessage(input: {
    liveId: string;
    senderId: string;
    senderRole: ChatMessage['sender']['role'];
    clientMessageId: string;
    content: string;
  }) {
    return this.liveRepository.createMessage(input);
  }

  createOrder(input: {
    liveId: string;
    userId: string;
    productVariantId: string;
    quantity: number;
    idempotencyKey: string;
  }) {
    return this.liveRepository.createOrder(input);
  }

  getRecentOrders(liveId: string, query: OrdersQuery) {
    return this.liveRepository.getRecentOrders(liveId, query);
  }

  hideMessage(input: { liveId: string; messageId: string; actorId: string; reason: string }) {
    return this.liveRepository.hideMessage(input);
  }

  timeoutUser(input: {
    liveId: string;
    userId: string;
    actorId: string;
    durationMinutes: number;
    reason: string;
  }) {
    return this.liveRepository.timeoutUser(input);
  }

  publishCoupon(input: {
    liveId: string;
    actorId: string;
    type: Coupon['type'];
    value: number;
    minOrderAmountKrw: number;
    endsAt: string;
    usageLimit: number | null;
  }) {
    return this.liveRepository.publishCoupon(input);
  }

  publishAnnouncement(input: { liveId: string; actorId: string; content: string }) {
    return this.liveRepository.publishAnnouncement(input);
  }

  featureProduct(input: { liveId: string; productId: string | null; actorId: string }) {
    return this.liveRepository.featureProduct(input);
  }

  changeLiveStatus(input: { liveId: string; actorId: string; action: LiveStatusTransitionAction }) {
    return this.liveRepository.changeLiveStatus(input);
  }

  getAuditLogs(liveId: string, query: AuditLogsQuery) {
    return this.liveRepository.getAuditLogs(liveId, query);
  }

  getAiSuggestions(liveId: string) {
    return this.liveRepository.getAiSuggestions(liveId);
  }

  async createChatSummarySuggestion(input: {
    liveId: string;
    actorId: string;
    maxMessages: number;
  }) {
    const [snapshot, messagePage] = await Promise.all([
      this.liveRepository.getSnapshot(input.liveId),
      this.liveRepository.getMessages(input.liveId, { limit: input.maxMessages }),
    ]);

    if (!snapshot || !messagePage) {
      return { kind: 'live_not_found' } as const;
    }

    if (messagePage.messages.length === 0) {
      return { kind: 'no_chat_messages' } as const;
    }

    const output = this.aiService.summarizeChat(messagePage.messages, snapshot.featuredProduct);
    const inputHash = createHash('sha256')
      .update(
        JSON.stringify({
          featuredProductId: snapshot.featuredProduct?.id ?? null,
          messages: messagePage.messages.map((message) => ({
            content: message.content,
            id: message.id,
          })),
        }),
      )
      .digest('hex');

    return this.liveRepository.createAiSuggestion({
      actorId: input.actorId,
      inputHash,
      liveId: input.liveId,
      output,
    });
  }

  reviewAiSuggestion(input: {
    suggestionId: string;
    actorId: string;
    action: ReviewAiSuggestionRequest['action'];
    editedOutput?: ReviewAiSuggestionRequest['editedOutput'];
    announcementContent?: ReviewAiSuggestionRequest['announcementContent'];
    reason?: ReviewAiSuggestionRequest['reason'];
  }) {
    return this.liveRepository.reviewAiSuggestion(input);
  }

  async answerProductQuestion(liveId: string, question: string) {
    const snapshot = await this.liveRepository.getSnapshot(liveId);

    if (!snapshot) {
      return { kind: 'live_not_found' } as const;
    }

    if (!snapshot.featuredProduct) {
      return { kind: 'featured_product_not_found' } as const;
    }

    return {
      kind: 'answered',
      answer: this.aiService.answerProductQuestion(snapshot.featuredProduct, question),
    } as const;
  }
}
