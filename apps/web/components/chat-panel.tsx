'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ChatMessage, LiveSnapshot, Role } from '@liveflow/contracts';
import { type FormEvent, type KeyboardEvent, useEffect, useRef, useState } from 'react';
import {
  type PendingChatMessage,
  VirtualizedChatMessageList,
} from './virtualized-chat-message-list';
import {
  ApiRequestError,
  createChatMessage,
  liveSnapshotQueryKey,
  mergeChatMessage,
} from '../lib/live-api';

type ChatPanelProps = {
  liveId: string;
  accessToken: string | null;
  currentUser: {
    id: string;
    nickname: string;
    role: Role;
  } | null;
  hasMore: boolean;
  messages: ChatMessage[];
  sessionError?: string | null;
  chatTimeoutExpiresAt?: string | null;
  variant: 'viewer' | 'admin';
  onHideMessage?: (messageId: string, reason: string) => void;
  hidingMessageId?: string | null;
  onTimeoutUser?: (userId: string, durationMinutes: number, reason: string) => void;
  timingOutUserId?: string | null;
  moderationError?: string | null;
};

const timeoutTimeFormatter = new Intl.DateTimeFormat('ko-KR', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Asia/Seoul',
});

export function ChatPanel({
  liveId,
  accessToken,
  currentUser,
  hasMore,
  messages,
  sessionError,
  chatTimeoutExpiresAt,
  variant,
  onHideMessage,
  hidingMessageId,
  onTimeoutUser,
  timingOutUserId,
  moderationError,
}: ChatPanelProps) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const isComposingRef = useRef(false);
  const [pendingMessages, setPendingMessages] = useState<PendingChatMessage[]>([]);
  const timeoutAt = chatTimeoutExpiresAt ? Date.parse(chatTimeoutExpiresAt) : Number.NaN;
  const isChatTimedOut = Number.isFinite(timeoutAt) && timeoutAt > now;

  useEffect(() => {
    if (!Number.isFinite(timeoutAt) || timeoutAt <= Date.now()) {
      return undefined;
    }

    const timeoutId = window.setTimeout(
      () => {
        setNow(Date.now());
      },
      timeoutAt - Date.now() + 100,
    );

    return () => window.clearTimeout(timeoutId);
  }, [timeoutAt]);
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
  const isSending = pendingMessages.some((pendingMessage) => pendingMessage.status === 'SENDING');

  function sendMessage(clientMessageId: string, content: string): void {
    if (isChatTimedOut) {
      return;
    }

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
    if (!content || !accessToken || !currentUser || isSending || isChatTimedOut) {
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

      <VirtualizedChatMessageList
        currentUser={currentUser}
        hasMore={hasMore}
        hidingMessageId={hidingMessageId}
        liveId={liveId}
        messages={messages}
        onHideMessage={onHideMessage}
        onTimeoutUser={onTimeoutUser}
        onRetryMessage={sendMessage}
        pendingMessages={pendingMessages}
        timingOutUserId={timingOutUserId}
      />

      {moderationError ? (
        <p className="chat-moderation-error" role="alert">
          {moderationError}
        </p>
      ) : null}

      <form className="chat-form" onSubmit={handleSubmit}>
        <label htmlFor={`${variant}-chat-draft`}>메시지 입력</label>
        <textarea
          disabled={!accessToken || !currentUser || isChatTimedOut}
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
          placeholder={
            isChatTimedOut
              ? '채팅 제한이 적용되어 있습니다'
              : accessToken
                ? '메시지를 입력하세요'
                : '채팅 세션을 준비하는 중입니다'
          }
          rows={2}
          value={draft}
        />
        <div className="chat-form-actions">
          <p aria-live="polite" className="chat-form-status">
            {sessionError ??
              (isChatTimedOut
                ? `채팅 제한됨 · ${timeoutTimeFormatter.format(new Date(timeoutAt))}까지`
                : sendMutation.isError
                  ? sendMutation.error instanceof ApiRequestError
                    ? sendMutation.error.message
                    : '메시지를 보내지 못했습니다. 다시 시도해 주세요.'
                  : 'Enter로 전송 · Shift + Enter로 줄바꿈')}
          </p>
          <button
            disabled={!draft.trim() || !accessToken || !currentUser || isSending || isChatTimedOut}
            type="submit"
          >
            보내기
          </button>
        </div>
      </form>
    </section>
  );
}
