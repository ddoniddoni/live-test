import { Inject, Injectable } from '@nestjs/common';
import { aiChatSummarySchema, aiProductAnswerSchema } from '@liveflow/contracts';
import type {
  AiChatSummary,
  AiChatSummaryGroup,
  AiProductAnswer,
  ChatMessage,
  Product,
} from '@liveflow/contracts';

import { evaluateProductAnswerFixtures } from './ai-product-answer-evaluator.js';
import { LIVEFLOW_CONFIGURATION, type LiveFlowConfiguration } from './server-configuration.js';

export class AiProviderUnavailableError extends Error {
  constructor() {
    super('The configured AI provider is unavailable.');
    this.name = 'AiProviderUnavailableError';
  }
}

function includesAny(question: string, keywords: readonly string[]): boolean {
  return keywords.some((keyword) => question.includes(keyword));
}

function createMockProductAnswer(product: Product, question: string): AiProductAnswer {
  const normalizedQuestion = question.trim().toLocaleLowerCase('ko-KR');
  const variantNames = product.variants.map((variant) => variant.name).join(', ');

  if (includesAny(normalizedQuestion, ['사이즈', 'size', '키', '몸무게', '체형', '핏'])) {
    return aiProductAnswerSchema.parse({
      answer: `${product.name}은 현재 ${variantNames} 옵션으로 판매 중입니다. ${product.description} 다만 키·몸무게만으로 정확한 사이즈를 확정하기는 어려우니, 평소 선호하는 핏과 상세 실측은 운영자에게 한 번 더 확인해 주세요.`,
      sourceIds: ['product.description', 'product.variants'],
      confidence: 0.58,
      needsHumanReview: true,
      reason: '체형별 사이즈 추천은 등록된 상품 정보만으로 확정할 수 없습니다.',
    });
  }

  if (includesAny(normalizedQuestion, ['배송', '도착', '출고', '언제 받을'])) {
    return aiProductAnswerSchema.parse({
      answer: `${product.name}의 등록 정보에는 배송 출발일이나 도착 예정일이 포함되어 있지 않습니다. 정확한 배송 일정은 운영자가 확인한 뒤 안내해 드려야 합니다.`,
      sourceIds: ['product.description'],
      confidence: 0.96,
      needsHumanReview: true,
      reason: '배송 일정은 현재 등록된 상품 근거에 없습니다.',
    });
  }

  if (includesAny(normalizedQuestion, ['교환', '환불', '반품', '취소'])) {
    return aiProductAnswerSchema.parse({
      answer: `${product.name}의 등록 정보에는 교환·환불 조건이 포함되어 있지 않습니다. 정책 확인이 필요한 질문이므로 운영자가 확인한 뒤 안내해 드려야 합니다.`,
      sourceIds: ['product.description'],
      confidence: 0.96,
      needsHumanReview: true,
      reason: '교환·환불 정책은 현재 등록된 상품 근거에 없습니다.',
    });
  }

  if (includesAny(normalizedQuestion, ['소재', '재질', '계절', '여름', '통기', '부드럽'])) {
    return aiProductAnswerSchema.parse({
      answer: `${product.description} 현재 선택 가능한 옵션은 ${variantNames}입니다.`,
      sourceIds: ['product.description', 'product.variants'],
      confidence: 0.92,
      needsHumanReview: false,
      reason: '등록된 상품 설명과 판매 옵션을 근거로 답변했습니다.',
    });
  }

  return aiProductAnswerSchema.parse({
    answer: `${product.name}에 대해 확인 가능한 정보는 다음과 같습니다. ${product.description} 현재 선택 가능한 옵션은 ${variantNames}입니다. 질문에 대한 확정 답변에 추가 정보가 필요하면 운영자가 확인한 뒤 안내해 드려야 합니다.`,
    sourceIds: ['product.description', 'product.variants'],
    confidence: 0.64,
    needsHumanReview: true,
    reason: '질문에 필요한 세부 정보가 등록된 상품 근거에 충분하지 않습니다.',
  });
}

type ChatSummaryTopic = {
  topic: string;
  keywords: readonly string[];
  suggestedAnswer: (product: Product | null) => string;
  sourceIds: (product: Product | null) => string[];
  risk: AiChatSummaryGroup['risk'];
};

const chatSummaryTopics: readonly ChatSummaryTopic[] = [
  {
    topic: '배송 문의',
    keywords: ['배송', '출고', '도착', '언제 와', '언제오'],
    suggestedAnswer: () => '배송 일정은 운영자가 확인한 뒤 정확한 내용으로 안내드리겠습니다.',
    sourceIds: () => ['chat.messages'],
    risk: 'MEDIUM',
  },
  {
    topic: '교환·환불 문의',
    keywords: ['교환', '환불', '반품', '취소'],
    suggestedAnswer: () => '교환·환불 조건은 운영자가 정책을 확인한 뒤 안내드리겠습니다.',
    sourceIds: () => ['chat.messages'],
    risk: 'HIGH',
  },
  {
    topic: '사이즈 문의',
    keywords: ['사이즈', 'size', '키', '몸무게', '체형', '핏'],
    suggestedAnswer: (product) =>
      product
        ? `${product.name}의 옵션과 상세 정보는 현재 상품 카드에서 확인할 수 있습니다. 체형별 추천은 운영자가 추가 확인 후 안내드리겠습니다.`
        : '사이즈 추천은 운영자가 상세 정보를 확인한 뒤 안내드리겠습니다.',
    sourceIds: (product) =>
      product ? ['product.description', 'product.variants', 'chat.messages'] : ['chat.messages'],
    risk: 'MEDIUM',
  },
  {
    topic: '상품 정보 문의',
    keywords: ['소재', '재질', '계절', '여름', '통기', '부드러', '색상', '컬러'],
    suggestedAnswer: (product) =>
      product
        ? `${product.description} 현재 선택 가능한 옵션은 ${product.variants.map((variant) => variant.name).join(', ')}입니다.`
        : '현재 소개 상품 정보를 확인한 뒤 안내드리겠습니다.',
    sourceIds: (product) =>
      product ? ['product.description', 'product.variants'] : ['chat.messages'],
    risk: 'LOW',
  },
];

const negativeSentimentKeywords = ['별로', '실망', '문제', '늦', '안 와', '안와', '불만', '화나'];
const positiveSentimentKeywords = ['좋아', '예뻐', '기대', '감사', '최고'];

function findSummaryTopic(content: string): ChatSummaryTopic | null {
  const normalizedContent = content.toLocaleLowerCase('ko-KR');
  return chatSummaryTopics.find((topic) => includesAny(normalizedContent, topic.keywords)) ?? null;
}

function determineOverallSentiment(messages: ChatMessage[]): AiChatSummary['overallSentiment'] {
  const score = messages.reduce((total, message) => {
    const normalizedContent = message.content.toLocaleLowerCase('ko-KR');
    const negativeMatches = negativeSentimentKeywords.filter((keyword) =>
      normalizedContent.includes(keyword),
    ).length;
    const positiveMatches = positiveSentimentKeywords.filter((keyword) =>
      normalizedContent.includes(keyword),
    ).length;

    return total + positiveMatches - negativeMatches;
  }, 0);

  if (score < 0) {
    return 'NEGATIVE';
  }

  return score > 0 ? 'POSITIVE' : 'NEUTRAL';
}

function createMockChatSummary(messages: ChatMessage[], product: Product | null): AiChatSummary {
  const messagesByTopic = new Map<ChatSummaryTopic, ChatMessage[]>();

  for (const message of messages) {
    const topic = findSummaryTopic(message.content);
    if (!topic) {
      continue;
    }

    const groupedMessages = messagesByTopic.get(topic) ?? [];
    groupedMessages.push(message);
    messagesByTopic.set(topic, groupedMessages);
  }

  const groups = chatSummaryTopics.flatMap((topic) => {
    const topicMessages = messagesByTopic.get(topic);
    if (!topicMessages || topicMessages.length === 0) {
      return [];
    }

    return [
      {
        topic: topic.topic,
        count: topicMessages.length,
        exampleMessageIds: topicMessages.slice(0, 3).map((message) => message.id),
        suggestedAnswer: topic.suggestedAnswer(product),
        sourceIds: topic.sourceIds(product),
        risk: topic.risk,
      },
    ];
  });

  return aiChatSummarySchema.parse({
    groups,
    overallSentiment: determineOverallSentiment(messages),
    requiresImmediateAttention:
      groups.some((group) => group.risk === 'HIGH') ||
      groups.some((group) => group.topic === '배송 문의' && group.count >= 3),
  });
}

@Injectable()
export class AiService {
  constructor(
    @Inject(LIVEFLOW_CONFIGURATION)
    private readonly configuration: LiveFlowConfiguration,
  ) {}

  answerProductQuestion(product: Product, question: string): AiProductAnswer {
    if (this.configuration.aiMode !== 'mock') {
      throw new AiProviderUnavailableError();
    }

    return createMockProductAnswer(product, question);
  }

  summarizeChat(messages: ChatMessage[], product: Product | null): AiChatSummary {
    if (this.configuration.aiMode !== 'mock') {
      throw new AiProviderUnavailableError();
    }

    return createMockChatSummary(messages, product);
  }

  evaluateProductAnswerFixtures() {
    if (this.configuration.aiMode !== 'mock') {
      throw new AiProviderUnavailableError();
    }

    return evaluateProductAnswerFixtures(createMockProductAnswer);
  }
}

export { createMockChatSummary, createMockProductAnswer };
