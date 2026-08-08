import { describe, expect, it } from 'vitest';
import type { ChatMessage, Product } from '@liveflow/contracts';

import { evaluateProductAnswerFixtures } from './ai-product-answer-evaluator.js';
import { createMockChatSummary, createMockProductAnswer } from './ai.service.js';

const softKnit: Product = {
  id: 'soft-knit',
  name: '소프트 릴랙스 니트',
  description: '피부에 부드럽게 닿는 여름용 릴랙스 핏 니트입니다.',
  priceKrw: 39_000,
  variants: [
    { id: 'soft-knit-s', name: 'S', stock: 8 },
    { id: 'soft-knit-m', name: 'M', stock: 12 },
  ],
};

describe('createMockProductAnswer', () => {
  it('grounds material and season questions in product description', () => {
    expect(createMockProductAnswer(softKnit, '여름에 입기 괜찮나요?')).toMatchObject({
      sourceIds: ['product.description', 'product.variants'],
      confidence: 0.92,
      needsHumanReview: false,
    });
  });

  it('marks sizing and policy questions for human review', () => {
    expect(createMockProductAnswer(softKnit, '175cm이면 어떤 사이즈인가요?')).toMatchObject({
      needsHumanReview: true,
      sourceIds: ['product.description', 'product.variants'],
    });
    expect(createMockProductAnswer(softKnit, '배송은 언제 오나요?')).toMatchObject({
      needsHumanReview: true,
      sourceIds: ['product.description'],
    });
  });
});

describe('evaluateProductAnswerFixtures', () => {
  it('reports schema, source, and human review checks for every curated fixture', () => {
    const report = evaluateProductAnswerFixtures(createMockProductAnswer);

    expect(report).toMatchObject({
      provider: 'mock',
      modelOrMockVersion: 'mock-product-answer-v1',
      totalCases: 20,
      passedCaseCount: 20,
      schemaValidCaseCount: 20,
      sourceMatchedCaseCount: 20,
      humanReviewMatchedCaseCount: 20,
      failureCounts: [],
    });
  });

  it('records an invalid response as a failed schema evaluation', () => {
    const report = evaluateProductAnswerFixtures(() => ({ answer: '' }));
    const firstCase = report.cases[0];

    expect(firstCase).toMatchObject({
      schemaValid: false,
      sourceMatched: false,
      humanReviewMatched: false,
      passed: false,
      failureTypes: ['SCHEMA_INVALID', 'SOURCE_MISMATCH', 'HUMAN_REVIEW_MISMATCH'],
    });
    expect(report.failureCounts).toContainEqual({ type: 'SCHEMA_INVALID', count: 20 });
  });
});

describe('createMockChatSummary', () => {
  it('groups deterministic shipping and policy questions with their supporting source IDs', () => {
    const messages: ChatMessage[] = [
      {
        id: 'message-1',
        clientMessageId: '0e3df3e8-7374-4d7a-8b2d-152b655c7d6f',
        roomId: 'demo-chat',
        liveId: 'demo',
        sender: { id: 'demo-viewer', nickname: 'Demo Viewer', role: 'VIEWER' },
        sequence: 1,
        type: 'USER',
        visibility: 'VISIBLE',
        content: '배송은 언제 출고되나요?',
        createdAt: '2026-08-01T00:00:00.000Z',
      },
      {
        id: 'message-2',
        clientMessageId: '1e3df3e8-7374-4d7a-8b2d-152b655c7d6f',
        roomId: 'demo-chat',
        liveId: 'demo',
        sender: { id: 'demo-viewer', nickname: 'Demo Viewer', role: 'VIEWER' },
        sequence: 2,
        type: 'USER',
        visibility: 'VISIBLE',
        content: '환불 가능한가요?',
        createdAt: '2026-08-01T00:00:01.000Z',
      },
    ];

    expect(createMockChatSummary(messages, softKnit)).toMatchObject({
      groups: [
        { topic: '배송 문의', count: 1, sourceIds: ['chat.messages'], risk: 'MEDIUM' },
        { topic: '교환·환불 문의', count: 1, sourceIds: ['chat.messages'], risk: 'HIGH' },
      ],
      requiresImmediateAttention: true,
    });
  });
});
