'use client';

import { useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import Link from 'next/link';

import { ApiRequestError, createAdminSession } from '@/lib/live-api';

import { useAdminSession } from './admin-session-provider';

type AdminSessionGateProps = {
  children: (accessToken: string) => ReactNode;
};

export function AdminSessionGate({ children }: AdminSessionGateProps) {
  const { accessToken, isRestoring, setAccessToken } = useAdminSession();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      setAccessToken(await createAdminSession(password));
      setPassword('');
    } catch (submissionError: unknown) {
      setError(
        submissionError instanceof ApiRequestError
          ? submissionError.message
          : '관리자 인증을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isRestoring) {
    return <AdminSessionLoadingState />;
  }

  if (accessToken) {
    return children(accessToken);
  }

  return (
    <main className="admin-access-shell">
      <section className="admin-access-card" aria-labelledby="admin-access-heading">
        <Link className="admin-access-brand" href="/">
          StreamOps <strong>Elite</strong>
        </Link>
        <div className="admin-access-copy">
          <p className="panel-kicker">LIVEFLOW / ADMIN ACCESS</p>
          <h1 id="admin-access-heading">운영자 화면</h1>
          <p>관리자 비밀번호를 확인한 뒤 방송 관리와 운영 화면으로 이동합니다.</p>
        </div>
        <form aria-busy={isSubmitting} onSubmit={handleSubmit}>
          <label htmlFor="admin-password">관리자 비밀번호</label>
          <input
            autoComplete="current-password"
            autoFocus
            id="admin-password"
            onChange={(event) => setPassword(event.target.value)}
            required
            type="password"
            value={password}
          />
          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}
          <button disabled={isSubmitting || password.trim().length === 0} type="submit">
            {isSubmitting ? '인증 확인 중…' : '운영자 화면 열기'}
          </button>
        </form>
        <div className="admin-access-footer">
          <p className="admin-access-note">
            인증 전에는 방송 초안, 방송 제어, 채팅 관리, 주문 정보가 표시되지 않습니다.
          </p>
          <Link className="admin-access-home-link" href="/">
            시청자 홈으로 돌아가기
          </Link>
        </div>
      </section>
    </main>
  );
}

function AdminSessionLoadingState() {
  return (
    <main className="admin-access-shell">
      <p className="admin-session-loading" role="status">
        관리자 세션을 확인하는 중입니다…
      </p>
    </main>
  );
}
