import { describe, expect, it } from 'vitest';

import { DEMO_CHAT_MESSAGE_COUNT, createDemoChatMessages } from './demo-chat-seed.js';

describe('createDemoChatMessages', () => {
  it('creates a deterministic 2,000-message history with stable identifiers and sequences', () => {
    const messages = createDemoChatMessages('demo-chat', 'demo-admin', 'demo-viewer');

    expect(messages).toHaveLength(DEMO_CHAT_MESSAGE_COUNT);
    expect(messages[0]).toMatchObject({
      id: 'demo-message-1',
      roomId: 'demo-chat',
      senderId: 'demo-admin',
      sequence: 1,
      type: 'ADMIN',
    });
    expect(messages.at(-1)).toMatchObject({
      id: 'demo-message-2000',
      sequence: DEMO_CHAT_MESSAGE_COUNT,
      type: 'ADMIN',
    });
    expect(messages[0]?.createdAt.toISOString()).toBe('2026-01-15T10:00:00.000Z');
    expect(new Set(messages.map((message) => message.clientMessageId))).toHaveLength(
      DEMO_CHAT_MESSAGE_COUNT,
    );
  });
});
