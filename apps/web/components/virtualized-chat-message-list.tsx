'use client';

import { forwardRef, useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { Virtualizer } from '@tanstack/react-virtual';
import type { ChatMessage, LiveSnapshot, Role } from '@liveflow/contracts';

import { fetchChatMessages, liveSnapshotQueryKey, prependChatMessagePage } from '@/lib/live-api';

export type PendingChatMessage = {
  clientMessageId: string;
  content: string;
  status: 'SENDING' | 'FAILED';
};

type ChatListItem =
  | { kind: 'history'; key: 'history' }
  | { kind: 'empty'; key: 'empty' }
  | { kind: 'message'; key: string; message: ChatMessage }
  | { kind: 'pending'; key: string; message: PendingChatMessage };

type VirtualizedChatMessageListProps = {
  currentUser: { id: string; nickname: string; role: Role } | null;
  hasMore: boolean;
  hidingMessageId: string | null | undefined;
  liveId: string;
  messages: ChatMessage[];
  onHideMessage: ((messageId: string, reason: string) => void) | undefined;
  onTimeoutUser: ((userId: string, durationMinutes: number, reason: string) => void) | undefined;
  onRetryMessage: (clientMessageId: string, content: string) => void;
  pendingMessages: PendingChatMessage[];
  timingOutUserId: string | null | undefined;
};

const chatRowGap = 11;
const chatScrollEndThreshold = 80;
const timeFormatter = new Intl.DateTimeFormat('ko-KR', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Asia/Seoul',
});

function formatMessageTime(createdAt: string): string {
  return timeFormatter.format(new Date(createdAt));
}

function countMessagesAfter(messages: ChatMessage[], sequence: number): number {
  let lowerBound = 0;
  let upperBound = messages.length;

  while (lowerBound < upperBound) {
    const middle = Math.floor((lowerBound + upperBound) / 2);
    if ((messages[middle]?.sequence ?? 0) <= sequence) {
      lowerBound = middle + 1;
    } else {
      upperBound = middle;
    }
  }

  return messages.length - lowerBound;
}

export function VirtualizedChatMessageList({
  currentUser,
  hasMore,
  hidingMessageId,
  liveId,
  messages,
  onHideMessage,
  onTimeoutUser,
  onRetryMessage,
  pendingMessages,
  timingOutUserId,
}: VirtualizedChatMessageListProps) {
  const queryClient = useQueryClient();
  const [isAtLatest, setIsAtLatest] = useState(true);
  const [lastReadMessageSequence, setLastReadMessageSequence] = useState(
    () => messages.at(-1)?.sequence ?? 0,
  );
  const scrollElementRef = useRef<HTMLOListElement>(null);
  const didInitialScrollRef = useRef(false);
  const latestMessageSequence = messages.at(-1)?.sequence ?? 0;
  const persistedClientMessageIds = useMemo(
    () => new Set(messages.map((message) => message.clientMessageId)),
    [messages],
  );
  const displayedPendingMessages = useMemo(
    () =>
      pendingMessages.filter(
        (pendingMessage) => !persistedClientMessageIds.has(pendingMessage.clientMessageId),
      ),
    [pendingMessages, persistedClientMessageIds],
  );
  const chatListItems = useMemo<ChatListItem[]>(() => {
    const items: ChatListItem[] = [];

    if (hasMore) {
      items.push({ kind: 'history', key: 'history' });
    }

    items.push(
      ...messages.map((message) => ({ kind: 'message' as const, key: message.id, message })),
    );
    items.push(
      ...displayedPendingMessages.map((message) => ({
        kind: 'pending' as const,
        key: `pending:${message.clientMessageId}`,
        message,
      })),
    );

    if (items.length === 0) {
      items.push({ kind: 'empty', key: 'empty' });
    }

    return items;
  }, [displayedPendingMessages, hasMore, messages]);
  const getItemKey = useCallback(
    (index: number) => chatListItems[index]?.key ?? index,
    [chatListItems],
  );
  const estimateSize = useCallback(
    (index: number) => (chatListItems[index]?.kind === 'message' ? 160 : 56),
    [chatListItems],
  );
  const handleVirtualizerChange = useCallback(
    (virtualizer: Virtualizer<HTMLOListElement, HTMLLIElement>) => {
      const nextIsAtLatest = virtualizer.isAtEnd(chatScrollEndThreshold);
      setIsAtLatest((current) => (current === nextIsAtLatest ? current : nextIsAtLatest));

      if (nextIsAtLatest) {
        setLastReadMessageSequence((current) =>
          current === latestMessageSequence ? current : latestMessageSequence,
        );
      }
    },
    [latestMessageSequence],
  );
  // TanStack Virtual manages imperative measurements and scroll anchoring outside React's cache.
  // Its hook output stays within this component and is not passed to memoized children.
  // eslint-disable-next-line react-hooks/incompatible-library
  const rowVirtualizer = useVirtualizer({
    anchorTo: 'end',
    count: chatListItems.length,
    estimateSize,
    followOnAppend: true,
    gap: chatRowGap,
    getItemKey,
    getScrollElement: () => scrollElementRef.current,
    onChange: handleVirtualizerChange,
    overscan: 6,
    scrollEndThreshold: chatScrollEndThreshold,
    // Row refs measure during React's commit phase; React 19 disallows the
    // virtualizer's default synchronous flush from that lifecycle boundary.
    useFlushSync: false,
  });
  const loadOlderMessagesMutation = useMutation({
    mutationFn: () => {
      const oldestMessage = messages[0];

      if (!oldestMessage) {
        throw new Error('이전 메시지를 불러올 기준이 없습니다.');
      }

      return fetchChatMessages(liveId, { beforeSequence: oldestMessage.sequence, limit: 50 });
    },
    onSuccess: (page) => {
      queryClient.setQueryData<LiveSnapshot>(liveSnapshotQueryKey(liveId), (snapshot) =>
        prependChatMessagePage(snapshot, page),
      );
    },
  });
  const unreadMessageCount = isAtLatest ? 0 : countMessagesAfter(messages, lastReadMessageSequence);

  useLayoutEffect(() => {
    if (didInitialScrollRef.current || chatListItems.length === 0) {
      return;
    }

    rowVirtualizer.scrollToEnd();
    didInitialScrollRef.current = true;
  }, [chatListItems.length, rowVirtualizer]);

  function jumpToLatest(): void {
    rowVirtualizer.scrollToEnd();
    setIsAtLatest(true);
    setLastReadMessageSequence(latestMessageSequence);
  }

  return (
    <>
      <ol
        aria-busy={loadOlderMessagesMutation.isPending}
        aria-label="실시간 채팅 메시지"
        className="chat-message-list"
        ref={scrollElementRef}
      >
        <li
          aria-hidden="true"
          className="chat-virtual-spacer"
          role="presentation"
          style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
        />
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const item = chatListItems[virtualRow.index];
          if (!item) {
            return null;
          }

          return (
            <ChatListRow
              currentUser={currentUser}
              hidingMessageId={hidingMessageId}
              isLoadingHistory={loadOlderMessagesMutation.isPending}
              key={virtualRow.key}
              onHideMessage={onHideMessage}
              onTimeoutUser={onTimeoutUser}
              onLoadOlderMessages={() => loadOlderMessagesMutation.mutate()}
              onRetryMessage={onRetryMessage}
              ref={rowVirtualizer.measureElement}
              row={virtualRow}
              rowItem={item}
              showHistoryError={loadOlderMessagesMutation.isError}
              timingOutUserId={timingOutUserId}
            />
          );
        })}
      </ol>

      {unreadMessageCount > 0 ? (
        <button className="chat-jump-latest" onClick={jumpToLatest} type="button">
          새 메시지 {unreadMessageCount}개 보기
        </button>
      ) : null}
    </>
  );
}

type ChatListRowProps = {
  currentUser: { id: string; nickname: string; role: Role } | null;
  hidingMessageId: string | null | undefined;
  isLoadingHistory: boolean;
  onHideMessage: ((messageId: string, reason: string) => void) | undefined;
  onTimeoutUser: ((userId: string, durationMinutes: number, reason: string) => void) | undefined;
  onLoadOlderMessages: () => void;
  onRetryMessage: (clientMessageId: string, content: string) => void;
  row: { index: number; start: number };
  rowItem: ChatListItem;
  showHistoryError: boolean;
  timingOutUserId: string | null | undefined;
};

const ChatListRow = forwardRef<HTMLLIElement, ChatListRowProps>(function ChatListRow(
  {
    currentUser,
    hidingMessageId,
    isLoadingHistory,
    onHideMessage,
    onTimeoutUser,
    onLoadOlderMessages,
    onRetryMessage,
    row,
    rowItem,
    showHistoryError,
    timingOutUserId,
  },
  ref,
) {
  const [hideReason, setHideReason] = useState('');
  const [timeoutReason, setTimeoutReason] = useState('');
  const [timeoutDurationMinutes, setTimeoutDurationMinutes] = useState(10);
  const rowStyle = { transform: `translateY(${row.start}px)` };

  if (rowItem.kind === 'history') {
    return (
      <li
        className="chat-history-row chat-virtual-row"
        data-index={row.index}
        ref={ref}
        style={rowStyle}
      >
        <button disabled={isLoadingHistory} onClick={onLoadOlderMessages} type="button">
          {isLoadingHistory ? '이전 메시지를 불러오는 중…' : '이전 메시지 불러오기'}
        </button>
        {showHistoryError ? (
          <p role="alert">이전 메시지를 불러오지 못했습니다. 다시 시도해 주세요.</p>
        ) : null}
      </li>
    );
  }

  if (rowItem.kind === 'empty') {
    return (
      <li className="chat-empty chat-virtual-row" data-index={row.index} ref={ref} style={rowStyle}>
        첫 메시지를 남겨 보세요.
      </li>
    );
  }

  if (rowItem.kind === 'pending') {
    return (
      <li
        className="chat-message chat-virtual-row is-current-user is-pending"
        data-index={row.index}
        ref={ref}
        style={rowStyle}
      >
        <div className="chat-message-meta">
          <strong>나</strong>
          <span>{rowItem.message.status === 'SENDING' ? '전송 중' : '전송 실패'}</span>
        </div>
        <p>{rowItem.message.content}</p>
        {rowItem.message.status === 'FAILED' ? (
          <button
            className="chat-retry"
            onClick={() => onRetryMessage(rowItem.message.clientMessageId, rowItem.message.content)}
            type="button"
          >
            다시 보내기
          </button>
        ) : null}
      </li>
    );
  }

  const isCurrentUser = rowItem.message.sender.id === currentUser?.id;
  const canHideMessage = Boolean(onHideMessage && rowItem.message.sender.role === 'VIEWER');
  const canTimeoutUser = Boolean(onTimeoutUser && rowItem.message.sender.role === 'VIEWER');

  return (
    <li
      className={`chat-message chat-virtual-row ${isCurrentUser ? 'is-current-user' : ''}`}
      data-index={row.index}
      ref={ref}
      style={rowStyle}
    >
      <div className="chat-message-meta">
        <strong>{isCurrentUser ? '나' : rowItem.message.sender.nickname}</strong>
        <span>{rowItem.message.sender.role === 'ADMIN' ? '운영자' : '시청자'}</span>
        <time dateTime={rowItem.message.createdAt}>
          {formatMessageTime(rowItem.message.createdAt)}
        </time>
      </div>
      <p>{rowItem.message.content}</p>
      {canHideMessage ? (
        <div className="chat-moderation">
          <label className="visually-hidden" htmlFor={`hide-reason-${rowItem.message.id}`}>
            {rowItem.message.sender.nickname} 메시지를 숨기는 사유
          </label>
          <input
            id={`hide-reason-${rowItem.message.id}`}
            maxLength={300}
            onChange={(event) => setHideReason(event.target.value)}
            placeholder="숨김 사유"
            value={hideReason}
          />
          <button
            disabled={!hideReason.trim() || hidingMessageId === rowItem.message.id}
            onClick={() => onHideMessage?.(rowItem.message.id, hideReason.trim())}
            type="button"
          >
            {hidingMessageId === rowItem.message.id ? '숨기는 중' : '숨기기'}
          </button>
        </div>
      ) : null}
      {canTimeoutUser ? (
        <div className="chat-timeout-control">
          <label className="visually-hidden" htmlFor={`timeout-reason-${rowItem.message.id}`}>
            {rowItem.message.sender.nickname}의 채팅을 제한하는 사유
          </label>
          <input
            id={`timeout-reason-${rowItem.message.id}`}
            maxLength={300}
            onChange={(event) => setTimeoutReason(event.target.value)}
            placeholder="제한 사유"
            value={timeoutReason}
          />
          <label className="visually-hidden" htmlFor={`timeout-duration-${rowItem.message.id}`}>
            채팅 제한 시간
          </label>
          <select
            id={`timeout-duration-${rowItem.message.id}`}
            onChange={(event) => setTimeoutDurationMinutes(Number(event.target.value))}
            value={timeoutDurationMinutes}
          >
            <option value={5}>5분</option>
            <option value={10}>10분</option>
            <option value={30}>30분</option>
            <option value={60}>60분</option>
          </select>
          <button
            disabled={!timeoutReason.trim() || timingOutUserId === rowItem.message.sender.id}
            onClick={() =>
              onTimeoutUser?.(
                rowItem.message.sender.id,
                timeoutDurationMinutes,
                timeoutReason.trim(),
              )
            }
            type="button"
          >
            {timingOutUserId === rowItem.message.sender.id ? '제한 중' : '채팅 제한'}
          </button>
        </div>
      ) : null}
    </li>
  );
});
