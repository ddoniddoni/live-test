'use client';

import Image from 'next/image';
import Link from 'next/link';
import type { FormEventHandler } from 'react';
import type { LiveSnapshot } from '@liveflow/contracts';

import { stitchAssets } from '@/lib/stitch-assets';

const krwFormatter = new Intl.NumberFormat('ko-KR', {
  style: 'currency',
  currency: 'KRW',
  maximumFractionDigits: 0,
});

function formatKrw(amount: number): string {
  return krwFormatter.format(amount);
}

type AdminSidebarProps = {
  accessToken: string | null;
  liveId: string;
  loginError: string | null;
  onLogin: FormEventHandler<HTMLFormElement>;
  onPasswordChange: (password: string) => void;
  password: string;
};

export function AdminSidebar({
  accessToken,
  liveId,
  loginError,
  onLogin,
  onPasswordChange,
  password,
}: AdminSidebarProps) {
  return (
    <aside className="admin-sidebar" aria-label="운영자 메뉴">
      <Link className="admin-brand" href="/">
        <span aria-hidden="true">▰</span>
        LiveFlow
      </Link>

      <div className="admin-profile">
        <span className="admin-profile-image">
          <Image alt="운영 관리자" fill sizes="48px" src={stitchAssets.adminProfile} />
        </span>
        <div>
          <strong>운영 관리자</strong>
          <small>LiveFlow Admin</small>
        </div>
      </div>

      {accessToken ? (
        <section className="admin-session-card">
          <span className="admin-session-dot" aria-hidden="true" />
          <div>
            <strong>관리자 세션 연결됨</strong>
            <small>운영 변경 권한 확인 완료</small>
          </div>
        </section>
      ) : (
        <section className="admin-login" aria-labelledby="login-heading">
          <p className="panel-kicker">DEMO ADMIN</p>
          <h2 id="login-heading">운영자 로그인</h2>
          <form onSubmit={onLogin}>
            <label htmlFor="admin-password">관리자 비밀번호</label>
            <input
              autoComplete="current-password"
              id="admin-password"
              onChange={(event) => onPasswordChange(event.target.value)}
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
      )}

      <Link className="admin-broadcast-button" href={`/live/${liveId}`}>
        시청자 화면 열기
      </Link>

      <nav className="admin-nav" aria-label="컨트롤룸 바로가기">
        <a className="is-active" href="#dashboard">
          <span aria-hidden="true">▦</span> 대시보드
        </a>
        <a href="#broadcast-preview">
          <span aria-hidden="true">▶</span> 라이브 관리
        </a>
        <a href="#product-control-heading">
          <span aria-hidden="true">□</span> 상품 관리
        </a>
        <a href="#coupon-control-heading">
          <span aria-hidden="true">◇</span> 쿠폰 설정
        </a>
        <a href="#admin-chat-heading">
          <span aria-hidden="true">○</span> 채팅 모니터링
        </a>
      </nav>
    </aside>
  );
}

type AdminProductControlProps = {
  accessToken: string | null;
  featuredProductId: string | null;
  isPending: boolean;
  mutationStatus: string;
  onFeature: (productId: string) => void;
  products: LiveSnapshot['products'];
};

export function AdminProductControl({
  accessToken,
  featuredProductId,
  isPending,
  mutationStatus,
  onFeature,
  products,
}: AdminProductControlProps) {
  return (
    <section className="product-control" aria-labelledby="product-control-heading">
      <div className="section-heading">
        <div>
          <p className="panel-kicker">FEATURED PRODUCT</p>
          <h2 id="product-control-heading">현재 소개 상품 선택</h2>
        </div>
        <p aria-live="polite" className="mutation-status">
          {mutationStatus}
        </p>
      </div>

      <div className="admin-product-grid">
        {products.map((product) => {
          const isFeatured = product.id === featuredProductId;
          return (
            <article
              className={`admin-product ${isFeatured ? 'is-featured' : ''}`}
              key={product.id}
            >
              <div className="admin-product-image">
                <Image
                  alt={`${product.name} 상품 이미지`}
                  fill
                  sizes="160px"
                  src={stitchAssets.adminProduct}
                />
              </div>
              <div className="admin-product-copy">
                <span>{isFeatured ? '노출 중' : '대기'}</span>
                <p className="product-name">{product.name}</p>
                <strong>{formatKrw(product.priceKrw)}</strong>
                <small>
                  총 재고 {product.variants.reduce((sum, variant) => sum + variant.stock, 0)}개
                </small>
              </div>
              <button
                disabled={!accessToken || isPending || isFeatured}
                onClick={() => onFeature(product.id)}
                type="button"
              >
                {isFeatured ? '현재 소개 중' : '소개하기'}
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}
