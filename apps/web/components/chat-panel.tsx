'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ChatMessage, LiveSnapshot, Role } from '@liveflow/contracts';
import { type FormEvent, type KeyboardEvent, useRef, useState } from 'react';
import {
  ApiRequestError,
  createChatMessage,
  liveSnapshotQueryKey,
  mergeChatMessage,
} from '../lib/live-api';

type PendingChatMessage = {
  clientMessageId: string;
  content: string;
  status: 'SENDING' | 'FAILED';
};

type ChatPanelProps = {
  liveId: string;
  accessToken: string | null;
  currentUser: {
    id: string;
    nickname: string;
    role: Role;
  } | null;
  messages: ChatMessage[];
  sessionError?: string | null;
  variant: 'viewer' | 'admin';
};

const timeFormatter = new Intl.DateTimeFormat('ko-KR', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Asia/Seoul',
});

function formatMessageTime(createdAt: string): string {
  return timeFormatter.format(new Date(createdAt));
}

export function ChatPanel({
  liveId,
  accessToken,
  currentUser,
  messages,
  sessionError,
  variant,
}: ChatPanelProps) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState('');
  const isComposingRef = useRef(false);
  const [pendingMessages, setPendingMessages] = useState<PendingChatMessage[]>([]);
  const sendMutation = useMutation({
    mutationFn: (input: { clientMessageId: string; content: string }) => {
      if (!accessToken) {
        throw new Error('채팅 세션을 준비하지 못했습니다.');
      }

      return createChatMessage(liveId, input, accessToken);
    },
    onSuccess: (message) => {
      queryClient.setQueryData<LiveSnapshot>(liveSnapshotQueryKey(liveId), (snapshot) =>
        mergeChatMessage(snapshot, message),
      );
      setPendingMessages((currentMessages) =>
        currentMessages.filter(
          (pendingMessage) => pendingMessage.clientMessageId !== message.clientMessageId,
        ),
      );
    },
    onError: (_error, input) => {
      setPendingMessages((currentMessages) =>
        currentMessages.map((pendingMessage) =>
          pendingMessage.clientMessageId === input.clientMessageId
            ? { ...pendingMessage, status: 'FAILED' }
            : pendingMessage,
        ),
      );
    },
  });

  const persistedClientMessageIds = new Set(messages.map((message) => message.clientMessageId));
  const displayedPendingMessages = pendingMessages.filter(
    (pendingMessage) => !persistedClientMessageIds.has(pendingMessage.clientMessageId),
  );
  const isSending = pendingMessages.some((pendingMessage) => pendingMessage.status === 'SENDING');

  function sendMessage(clientMessageId: string, content: string): void {
    setPendingMessages((currentMessages) => {
      const withoutPreviousAttempt = currentMessages.filter(
        (pendingMessage) => pendingMessage.clientMessageId !== clientMessageId,
      );
      return [...withoutPreviousAttempt, { clientMessageId, content, status: 'SENDING' }];
    });
    sendMutation.mutate({ clientMessageId, content });
  }

  function submitDraft(): void {
    const content = draft.trim();
    if (!content || !accessToken || !currentUser || isSending) {
      return;
    }

    setDraft('');
    sendMessage(crypto.randomUUID(), content);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    submitDraft();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>): void {
    if (event.key !== 'Enter' || event.shiftKey || isComposingRef.current) {
      return;
    }

    event.preventDefault();
    submitDraft();
  }

  return (
    <section
      className={`chat-panel chat-panel-${variant}`}
      aria-labelledby={`${variant}-chat-heading`}
    >
      <div className="chat-panel-header">
        <div>
          <p className="panel-kicker">LIVE CHAT</p>
          <h2 id={`${variant}-chat-heading`}>실시간 채팅</h2>
        </div>
        <span className="chat-count">메시지 {messages.length}개</span>
      </div>

      <ol className="chat-message-list" aria-label="실시간 채팅 메시지">
        {messages.map((message) => {
          const isCurrentUser = message.sender.id === currentUser?.id;
          return (
            <li
              className={`chat-message ${isCurrentUser ? 'is-current-user' : ''}`}
              key={message.id}
            >
              <div className="chat-message-meta">
                <strong>{isCurrentUser ? '나' : message.sender.nickname}</strong>
                <span>{message.sender.role === 'ADMIN' ? '운영자' : '시청자'}</span>
                <time dateTime={message.createdAt}>{formatMessageTime(message.createdAt)}</time>
              </div>
              <p>{message.content}</p>
            </li>
          );
        })}

        {displayedPendingMessages.map((message) => (
          <li className="chat-message is-current-user is-pending" key={message.clientMessageId}>
            <div className="chat-message-meta">
              <strong>나</strong>
              <span>{message.status === 'SENDING' ? '전송 중' : '전송 실패'}</span>
            </div>
            <p>{message.content}</p>
            {message.status === 'FAILED' ? (
              <button
                className="chat-retry"
                onClick={() => sendMessage(message.clientMessageId, message.content)}
                type="button"
              >
                다시 보내기
              </button>
            ) : null}
          </li>
        ))}

        {messages.length === 0 && displayedPendingMessages.length === 0 ? (
          <li className="chat-empty">첫 메시지를 남겨 보세요.</li>
        ) : null}
      </ol>

      <form className="chat-form" onSubmit={handleSubmit}>
        <label htmlFor={`${variant}-chat-draft`}>메시지 입력</label>
        <textarea
          disabled={!accessToken || !currentUser}
          id={`${variant}-chat-draft`}
          maxLength={500}
          onChange={(event) => setDraft(event.target.value)}
          onCompositionEnd={() => {
            isComposingRef.current = false;
          }}
          onCompositionStart={() => {
            isComposingRef.current = true;
          }}
          onKeyDown={handleKeyDown}
          placeholder={accessToken ? '메시지를 입력하세요' : '채팅 세션을 준비하는 중입니다'}
          rows={2}
          value={draft}
        />
        <div className="chat-form-actions">
          <p aria-live="polite" className="chat-form-status">
            {sessionError ??
              (sendMutation.isError
                ? sendMutation.error instanceof ApiRequestError
                  ? sendMutation.error.message
                  : '메시지를 보내지 못했습니다. 다시 시도해 주세요.'
                : 'Enter로 전송 · Shift + Enter로 줄바꿈')}
          </p>
          <button
            disabled={!draft.trim() || !accessToken || !currentUser || isSending}
            type="submit"
          >
            보내기
          </button>
        </div>
      </form>
    </section>
  );
}
