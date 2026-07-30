'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { LiveSnapshot } from '@liveflow/contracts';
import Link from 'next/link';
import { type FormEvent, useState } from 'react';
import { ChatPanel } from '../../../../components/chat-panel';
import {
  ApiRequestError,
  createAdminSession,
  featureProduct,
  fetchLiveSnapshot,
  liveSnapshotQueryKey,
  mergeProductFeaturedEvent,
} from '../../../../lib/live-api';
import { useLiveRealtime } from '../../../../lib/use-live-realtime';

const krwFormatter = new Intl.NumberFormat('ko-KR', {
  style: 'currency',
  currency: 'KRW',
  maximumFractionDigits: 0,
});

function formatKrw(amount: number): string {
  return krwFormatter.format(amount);
}

export function AdminRoom({ liveId }: { liveId: string }) {
  const queryClient = useQueryClient();
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const snapshotQuery = useQuery({
    queryKey: liveSnapshotQueryKey(liveId),
    queryFn: () => fetchLiveSnapshot(liveId),
  });
  const connectionState = useLiveRealtime(liveId, accessToken);

  const featureMutation = useMutation({
    mutationFn: (productId: string | null) => {
      if (!accessToken) {
        throw new Error('관리자 세션이 필요합니다.');
      }

      return featureProduct(liveId, productId, accessToken);
    },
    onSuccess: (event) => {
      queryClient.setQueryData<LiveSnapshot>(liveSnapshotQueryKey(liveId), (snapshot) =>
        mergeProductFeaturedEvent(snapshot, event),
      );
    },
  });

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

  if (snapshotQuery.isPending) {
    return <main className="screen-state">운영자 컨트롤룸을 준비하는 중입니다…</main>;
  }

  if (snapshotQuery.isError || !snapshotQuery.data) {
    return (
      <main className="screen-state" role="alert">
        방송 정보를 불러오지 못했습니다. API 서버가 실행 중인지 확인해 주세요.
      </main>
    );
  }

  const snapshot = snapshotQuery.data;

  return (
    <main className="live-shell admin-shell">
      <header className="topbar">
        <Link className="brand" href="/">
          LIVEFLOW / CONTROL ROOM
        </Link>
        <Link className="text-link" href={`/live/${liveId}`}>
          시청자 화면 보기
        </Link>
      </header>

      <section className="admin-header">
        <div>
          <p className="panel-kicker">BROADCAST CONTROL</p>
          <h1>{snapshot.live.title}</h1>
          <p>
            상태: {snapshot.live.status} · 실시간: {connectionState}
          </p>
        </div>
        {accessToken ? (
          <span className="admin-session-status">관리자 세션 연결됨</span>
        ) : (
          <span className="admin-session-status muted">관리자 로그인이 필요합니다</span>
        )}
      </section>

      {!accessToken ? (
        <section className="admin-login" aria-labelledby="login-heading">
          <div>
            <p className="panel-kicker">DEMO ADMIN</p>
            <h2 id="login-heading">상품 노출을 시작하려면 로그인하세요</h2>
            <p>배포 환경의 `DEMO_ADMIN_PASSWORD`와 일치하는 비밀번호가 필요합니다.</p>
          </div>
          <form onSubmit={handleLogin}>
            <label htmlFor="admin-password">관리자 비밀번호</label>
            <input
              autoComplete="current-password"
              id="admin-password"
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
            <button type="submit">관리자 세션 시작</button>
          </form>
        </section>
      ) : null}

      <ChatPanel
        accessToken={accessToken}
        currentUser={
          accessToken ? { id: 'demo-admin', nickname: 'LiveFlow Admin', role: 'ADMIN' } : null
        }
        liveId={liveId}
        messages={snapshot.chat.messages}
        sessionError={loginError}
        variant="admin"
      />

      <section className="product-control" aria-labelledby="product-control-heading">
        <div className="section-heading">
          <div>
            <p className="panel-kicker">FEATURED PRODUCT</p>
            <h2 id="product-control-heading">현재 소개 상품 선택</h2>
          </div>
          <p aria-live="polite" className="mutation-status">
            {featureMutation.isPending
              ? '상품을 저장하고 시청자에게 반영하는 중입니다…'
              : featureMutation.isError
                ? featureMutation.error instanceof Error
                  ? featureMutation.error.message
                  : '상품 변경에 실패했습니다.'
                : '저장 성공 후 실시간 이벤트가 발행됩니다.'}
          </p>
        </div>

        <div className="admin-product-grid">
          {snapshot.products.map((product) => {
            const isFeatured = product.id === snapshot.featuredProduct?.id;
            return (
              <article
                className={`admin-product ${isFeatured ? 'is-featured' : ''}`}
                key={product.id}
              >
                <div className="product-art" aria-hidden="true">
                  <span>{product.name.slice(0, 1)}</span>
                </div>
                <p className="product-name">{product.name}</p>
                <p>{product.description}</p>
                <strong>{formatKrw(product.priceKrw)}</strong>
                <p className="stock-summary">
                  총 재고 {product.variants.reduce((sum, variant) => sum + variant.stock, 0)}개
                </p>
                <button
                  disabled={!accessToken || featureMutation.isPending || isFeatured}
                  onClick={() => featureMutation.mutate(product.id)}
                  type="button"
                >
                  {isFeatured ? '현재 소개 중' : '이 상품 소개하기'}
                </button>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
