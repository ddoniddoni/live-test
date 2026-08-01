import { ChatMessageType } from '@prisma/client';

export const DEMO_CHAT_MESSAGE_COUNT = 2_000;

type DemoChatMessageSeed = {
  clientMessageId: string;
  content: string;
  createdAt: Date;
  id: string;
  roomId: string;
  senderId: string;
  sequence: number;
  type: ChatMessageType;
};

const demoChatStartedAt = Date.UTC(2026, 0, 15, 10, 0, 0);
const demoChatMessageTemplates = [
  {
    content: '안녕하세요! 오늘 소개 상품에 대해 편하게 질문해 주세요.',
    sender: 'ADMIN',
  },
  {
    content: '니트는 어떤 계절에 입기 좋은가요?',
    sender: 'VIEWER',
  },
  {
    content: '가벼운 여름 원사라 실내 냉방이나 초가을까지 활용하기 좋습니다.',
    sender: 'ADMIN',
  },
  {
    content: '배송은 언제 출발하나요?',
    sender: 'VIEWER',
  },
  {
    content: '오늘 주문 건은 영업일 기준 순차 출고되며, 재고는 실시간으로 반영됩니다.',
    sender: 'ADMIN',
  },
] as const;

export function createDemoChatMessages(
  roomId: string,
  adminId: string,
  viewerId: string,
): DemoChatMessageSeed[] {
  return Array.from({ length: DEMO_CHAT_MESSAGE_COUNT }, (_, index) => {
    const sequence = index + 1;
    const template = demoChatMessageTemplates[index % demoChatMessageTemplates.length];

    if (!template) {
      throw new Error('Demo chat message template is unavailable.');
    }

    return {
      clientMessageId: `00000000-0000-4000-8000-${sequence.toString(16).padStart(12, '0')}`,
      content: template.content,
      createdAt: new Date(demoChatStartedAt + index * 15_000),
      id: `demo-message-${sequence}`,
      roomId,
      senderId: template.sender === 'ADMIN' ? adminId : viewerId,
      sequence,
      type: template.sender === 'ADMIN' ? ChatMessageType.ADMIN : ChatMessageType.USER,
    };
  });
}
