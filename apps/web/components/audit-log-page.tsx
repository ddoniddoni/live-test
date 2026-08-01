'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import Link from 'next/link';
import { useInfiniteQuery } from '@tanstack/react-query';

import {
  ApiRequestError,
  auditLogsQueryKey,
  createAdminSession,
  fetchAuditLogs,
} from '@/lib/live-api';

const dateTimeFormatter = new Intl.DateTimeFormat('ko-KR', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Asia/Seoul',
});

const actionLabels: Record<string, string> = {
  AI_SUGGESTION_APPROVED: 'AI 제안 승인',
  AI_SUGGESTION_CREATED: 'AI 제안 생성',
  AI_SUGGESTION_EDITED: 'AI 제안 수정',
  AI_SUGGESTION_REJECTED: 'AI 제안 거절',
  ANNOUNCEMENT_PUBLISHED: '공지 발행',
  CHAT_MESSAGE_HIDDEN: '채팅 메시지 숨김',
  CHAT_USER_TIMED_OUT: '사용자 채팅 제한',
  COUPON_PUBLISHED: '쿠폰 발행',
  LIVE_ENDED: '방송 종료',
  LIVE_STARTED: '방송 시작',
  ORDER_CREATED: 'Mock 주문 생성',
  PRODUCT_FEATURED: '소개 상품 변경',
};

const entityLabels: Record<string, string> = {
  AI_SUGGESTION: 'AI 제안',
  ANNOUNCEMENT: '공지',
  CHAT_MESSAGE: '채팅 메시지',
  COUPON: '쿠폰',
  LIVE_SESSION: '방송',
  ORDER: '주문',
  PRODUCT: '상품',
  USER: '사용자',
};

function formatAction(action: string): string {
  return actionLabels[action] ?? action.replaceAll('_', ' ');
}

function formatEntity(entityType: string): string {
  return entityLabels[entityType] ?? entityType.replaceAll('_', ' ');
}

export function AuditLogPage({ liveId }: { liveId: string }) {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const auditLogsQuery = useInfiniteQuery({
    queryKey: auditLogsQueryKey(liveId),
    queryFn: ({ pageParam }) =>
      fetchAuditLogs(liveId, pageParam ? { cursor: pageParam } : {}, accessToken ?? ''),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: accessToken !== null,
  });
  const logs = auditLogsQuery.data?.pages.flatMap((page) => page.logs) ?? [];

  async function handleLogin(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setLoginError(null);

    try {
      const token = await createAdminSession(password);
      setAccessToken(token);
      setPassword('');
    } catch (error: unknown) {
      setLoginError(
        error instanceof ApiRequestError
          ? error.message
          : '관리자 세션을 준비하지 못했습니다. 잠시 후 다시 시도해 주세요.',
      );
    }
  }

  return (
    <main className="audit-log-shell">
      <header className="audit-log-header">
        <div>
          <p className="panel-kicker">ADMIN OPERATIONS</p>
          <h1>감사 로그</h1>
          <p>방송 운영 중 발생한 주요 변경 이력을 최신순으로 확인합니다.</p>
        </div>
        <Link className="audit-log-back-link" href={`/admin/lives/${liveId}`}>
          컨트롤룸으로 돌아가기
        </Link>
      </header>

      {accessToken ? (
        <section className="audit-log-panel" aria-labelledby="audit-log-list-heading">
          <header className="audit-log-panel-heading">
            <div>
              <p className="panel-kicker">PERSISTED HISTORY</p>
              <h2 id="audit-log-list-heading">운영 이력</h2>
            </div>
            <span aria-live="polite">
              {auditLogsQuery.isFetching ? '최신 이력을 불러오는 중…' : `${logs.length}건 표시`}
            </span>
          </header>

          {auditLogsQuery.isPending ? (
            <p className="audit-log-state" role="status">
              감사 로그를 불러오는 중입니다…
            </p>
          ) : auditLogsQuery.isError ? (
            <div className="audit-log-state" role="alert">
              <p>감사 로그를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</p>
              <button onClick={() => void auditLogsQuery.refetch()} type="button">
                다시 시도
              </button>
            </div>
          ) : logs.length === 0 ? (
            <p className="audit-log-state">아직 기록된 운영 행동이 없습니다.</p>
          ) : (
            <>
              <ol className="audit-log-list">
                {logs.map((log) => (
                  <li key={log.id}>
                    <div className="audit-log-action">
                      <strong>{formatAction(log.action)}</strong>
                      <span>{formatEntity(log.entityType)}</span>
                    </div>
                    <div className="audit-log-meta">
                      <span>{log.actor.nickname}</span>
                      <time dateTime={log.createdAt}>
                        {dateTimeFormatter.format(new Date(log.createdAt))}
                      </time>
                    </div>
                  </li>
                ))}
              </ol>
              {auditLogsQuery.hasNextPage ? (
                <button
                  className="audit-log-more-button"
                  disabled={auditLogsQuery.isFetchingNextPage}
                  onClick={() => void auditLogsQuery.fetchNextPage()}
                  type="button"
                >
                  {auditLogsQuery.isFetchingNextPage ? '이력 불러오는 중…' : '이전 이력 더 보기'}
                </button>
              ) : null}
            </>
          )}
        </section>
      ) : (
        <section className="audit-log-login" aria-labelledby="audit-log-login-heading">
          <p className="panel-kicker">DEMO ADMIN</p>
          <h2 id="audit-log-login-heading">관리자 인증이 필요합니다</h2>
          <p>감사 로그는 운영자만 볼 수 있습니다.</p>
          <form onSubmit={handleLogin}>
            <label htmlFor="audit-log-password">관리자 비밀번호</label>
            <input
              autoComplete="current-password"
              id="audit-log-password"
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
            {loginError ? (
              <p className="form-error" role="alert">
                {loginError}
              </p>
            ) : null}
            <button type="submit">감사 로그 열기</button>
          </form>
        </section>
      )}
    </main>
  );
}
