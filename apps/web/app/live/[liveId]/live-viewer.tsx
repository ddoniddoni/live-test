'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ChatPanel } from '../../../components/chat-panel';
import {
  ApiRequestError,
  createViewerSession,
  fetchLiveSnapshot,
  liveSnapshotQueryKey,
} from '../../../lib/live-api';
import { type ConnectionState, useLiveRealtime } from '../../../lib/use-live-realtime';

const krwFormatter = new Intl.NumberFormat('ko-KR', {
  style: 'currency',
  currency: 'KRW',
  maximumFractionDigits: 0,
});

function formatKrw(amount: number): string {
  return krwFormatter.format(amount);
}

function connectionLabel(connectionState: ConnectionState): string {
  const labels: Record<ConnectionState, string> = {
    CONNECTING: '실시간 서버 연결 중',
    CONNECTED: '실시간 연결됨',
    RECOVERING: '변경 사항 동기화 중',
    DISCONNECTED: '연결이 끊겼습니다',
    FAILED: '실시간 연결에 실패했습니다',
  };

  return labels[connectionState];
}

export function LiveViewer({ liveId }: { liveId: string }) {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const snapshotQuery = useQuery({
    queryKey: liveSnapshotQueryKey(liveId),
    queryFn: () => fetchLiveSnapshot(liveId),
  });
  const connectionState = useLiveRealtime(liveId, accessToken);

  useEffect(() => {
    let isActive = true;

    void createViewerSession()
      .then((token) => {
        if (isActive) {
          setAccessToken(token);
        }
      })
      .catch((error: unknown) => {
        if (isActive) {
          setSessionError(
            error instanceof ApiRequestError
              ? error.message
              : '시청자 세션을 준비하지 못했습니다. 잠시 후 다시 시도해 주세요.',
          );
        }
      });

    return () => {
      isActive = false;
    };
  }, []);

  if (snapshotQuery.isPending) {
    return <main className="screen-state">방송 정보를 불러오는 중입니다…</main>;
  }

  if (snapshotQuery.isError || !snapshotQuery.data) {
    return (
      <main className="screen-state" role="alert">
        방송 정보를 불러오지 못했습니다. API 서버가 실행 중인지 확인해 주세요.
      </main>
    );
  }

  const { featuredProduct, live } = snapshotQuery.data;

  return (
    <main className="live-shell viewer-shell">
      <header className="topbar">
        <Link className="brand" href="/">
          LIVEFLOW
        </Link>
        <Link className="text-link" href={`/admin/lives/${liveId}`}>
          운영자 화면
        </Link>
      </header>

      <section className="viewer-grid" aria-label="라이브 방송">
        <div className="broadcast-stage">
          <div className="live-badge">LIVE</div>
          <p className="stage-kicker">LIVEFLOW EDIT</p>
          <h1>{live.title}</h1>
          <p>오늘의 가볍고 편안한 여름 스타일을 함께 살펴보세요.</p>
          <div className="stage-orb stage-orb-one" aria-hidden="true" />
          <div className="stage-orb stage-orb-two" aria-hidden="true" />
        </div>

        <ChatPanel
          accessToken={accessToken}
          currentUser={
            accessToken ? { id: 'demo-viewer', nickname: 'Demo Viewer', role: 'VIEWER' } : null
          }
          liveId={liveId}
          messages={snapshotQuery.data.chat.messages}
          sessionError={sessionError}
          variant="viewer"
        />
      </section>

      <section className="connection-row" aria-live="polite">
        <span
          className={`connection-dot connection-${connectionState.toLowerCase()}`}
          aria-hidden="true"
        />
        {sessionError ?? connectionLabel(connectionState)}
      </section>

      <section className="featured-section" aria-labelledby="featured-heading">
        <div>
          <p className="panel-kicker">NOW SHOWING</p>
          <h2 id="featured-heading">현재 소개 상품</h2>
        </div>

        {featuredProduct ? (
          <article className="featured-product">
            <div className="product-art product-art-viewer" aria-hidden="true">
              <span>{featuredProduct.name.slice(0, 1)}</span>
            </div>
            <div className="product-copy">
              <p className="product-name">{featuredProduct.name}</p>
              <p>{featuredProduct.description}</p>
              <strong>{formatKrw(featuredProduct.priceKrw)}</strong>
              <dl className="variant-list">
                {featuredProduct.variants.map((variant) => (
                  <div key={variant.id}>
                    <dt>{variant.name}</dt>
                    <dd>재고 {variant.stock}개</dd>
                  </div>
                ))}
              </dl>
              <button disabled type="button">
                주문 기능 준비 중
              </button>
            </div>
          </article>
        ) : (
          <div className="empty-product">
            운영자가 상품을 소개하면 이 영역이 페이지 새로고침 없이 바뀝니다.
          </div>
        )}
      </section>
    </main>
  );
}
