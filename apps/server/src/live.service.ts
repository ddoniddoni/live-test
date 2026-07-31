import { Inject, Injectable } from '@nestjs/common';
import type { ChatMessage, ChatMessagesQuery, Coupon } from '@liveflow/contracts';

import type { LiveRepository } from './live-repository.js';
import { LIVE_REPOSITORY } from './server-configuration.js';

@Injectable()
export class LiveService {
  constructor(@Inject(LIVE_REPOSITORY) private readonly liveRepository: LiveRepository) {}

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

  featureProduct(input: { liveId: string; productId: string | null; actorId: string }) {
    return this.liveRepository.featureProduct(input);
  }
}
