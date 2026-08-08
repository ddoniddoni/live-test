import Image from 'next/image';
import Link from 'next/link';

import { getHomeCatalogLives, homeCategories } from '@/lib/home-catalog';
import { stitchAssets } from '@/lib/stitch-assets';
import type { HomeCategoryId } from '@/lib/home-catalog';

const liveCards = [
  {
    creator: '유니크 럭셔리',
    image: stitchAssets.homeLiveBeauty,
    title: '오늘만 30% 할인! 가을 명품 신상 쇼케이스',
    viewers: '1.2K',
  },
  {
    creator: '테크 리뷰어 J',
    image: stitchAssets.homeLiveTech,
    title: '몰입감 끝판왕! 신상 헤드폰 단독 특가',
    viewers: '856',
  },
  {
    creator: '프레시 푸드 마스터',
    image: stitchAssets.homeLiveFood,
    title: '집에서 즐기는 5성급 다이닝 스테이크 세트',
    viewers: '3.4K',
  },
  {
    creator: '데코 큐레이터',
    image: stitchAssets.homeLiveLiving,
    title: '나만의 아늑한 공간, 감성 인테리어 특집',
    viewers: '2.1K',
  },
  {
    creator: '스포츠 매니아',
    image: stitchAssets.homeLiveSport,
    title: '운동의 완성! F/W 베스트 아이템 모음',
    viewers: '5.2K',
  },
] as const;

const schedules = [
  { host: '인테리어 장인 민수', time: '18:30', title: '집들이 선물 고민 끝! 센스 만점 리빙템' },
  { host: '모두의 투어', time: '20:00', title: '반값으로 떠나는 도쿄 여행! 특가 패키지' },
  { host: '먹방의 신', time: '21:30', title: '밤에 더 맛있는 야식 대전! 불닭 기획전' },
] as const;

const recommendations = [
  {
    image: stitchAssets.homeRecommendationBeauty,
    match: '90% MATCH',
    note: '최근 보신 뷰티 상품 연관',
    title: '수분 촉촉 가을 기초 라인',
  },
  {
    image: stitchAssets.homeRecommendationDesk,
    match: '82% MATCH',
    note: '찜하신 가구 상품 연관',
    title: '데스크테리어 필수 아이템',
  },
  {
    image: stitchAssets.homeRecommendationKeyboard,
    match: '75% MATCH',
    note: '관심 카테고리 테크 기반',
    title: '로지텍 신상 키보드 할인',
  },
] as const;

const currentLivePath = '/live';

function CategoryIcon({ category }: { category: HomeCategoryId }) {
  switch (category) {
    case 'all':
      return (
        <svg focusable="false" viewBox="0 0 24 24">
          <rect height="6" rx="1" width="6" x="4" y="4" />
          <rect height="6" rx="1" width="6" x="14" y="4" />
          <rect height="6" rx="1" width="6" x="4" y="14" />
          <rect height="6" rx="1" width="6" x="14" y="14" />
        </svg>
      );
    case 'beauty':
      return (
        <svg focusable="false" viewBox="0 0 24 24">
          <path d="M12 3l1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7L12 3z" />
          <path d="M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16z" />
        </svg>
      );
    case 'tech':
      return (
        <svg focusable="false" viewBox="0 0 24 24">
          <rect height="16" rx="2" width="11" x="6.5" y="4" />
          <path d="M10 17h4" />
        </svg>
      );
    case 'fashion':
      return (
        <svg focusable="false" viewBox="0 0 24 24">
          <path d="M8 5l4 2 4-2 4 4-3 3-1-1v8H8v-8l-1 1-3-3 4-4z" />
          <path d="M10 5c0 1.3.8 2 2 2s2-.7 2-2" />
        </svg>
      );
    case 'food':
      return (
        <svg focusable="false" viewBox="0 0 24 24">
          <path d="M7 3v8M4 3v5a3 3 0 0 0 6 0V3M7 11v10" />
          <path d="M17 3c-2 2-3 4.6-3 7v4h3v7" />
        </svg>
      );
    case 'living':
      return (
        <svg focusable="false" viewBox="0 0 24 24">
          <path d="M4 11.5L12 5l8 6.5V20H4v-8.5z" />
          <path d="M10 20v-5h4v5" />
        </svg>
      );
    case 'sport':
      return (
        <svg focusable="false" viewBox="0 0 24 24">
          <path d="M3 9v6M6 7v10M18 7v10M21 9v6M6 12h12" />
        </svg>
      );
  }
}

export default function Home() {
  return (
    <main className="home-shell">
      <section className="home-hero" aria-label="대표 라이브 방송">
        <Image
          alt="전문 라이브 스튜디오에서 스마트폰을 소개하는 진행자"
          className="home-hero-image"
          fill
          priority
          sizes="100vw"
          src={stitchAssets.homeHero}
        />
        <div className="home-hero-gradient" aria-hidden="true" />
        <div className="home-hero-content">
          <div className="home-hero-statuses">
            <span className="home-live-badge">
              <i aria-hidden="true" /> LIVE NOW
            </span>
            <span className="home-viewer-badge">◉ 42.8K WATCHING</span>
          </div>
          <h1>Galaxy S24 Ultra: The AI Revolution Store Launch Event</h1>
          <p>
            최신 AI 기능을 라이브로 만나 보세요. 방송 중에만 받을 수 있는 한정 쿠폰과 번들 혜택이
            준비되어 있습니다.
          </p>
          <div className="home-hero-actions">
            <Link className="home-primary-link" href={currentLivePath}>
              Watch Now
            </Link>
            <a className="home-secondary-link" href="#live-now">
              View Products
            </a>
          </div>
        </div>
      </section>

      <section aria-label="카테고리" className="home-categories" id="categories">
        {homeCategories.map((category) => (
          <Link
            href={category.id === 'all' ? '#live-now' : `#category-${category.id}`}
            key={category.id}
          >
            <span aria-hidden="true">
              <CategoryIcon category={category.id} />
            </span>
            {category.label}
          </Link>
        ))}
      </section>

      <section className="home-content-section" id="live-now">
        <div className="home-section-heading">
          <h2>
            실시간 인기 라이브 <span>HOT</span>
          </h2>
          <Link href={currentLivePath}>전체보기 →</Link>
        </div>
        <div className="home-live-grid">
          {liveCards.map((liveCard) => (
            <Link
              aria-label={`${liveCard.title} 라이브 보기`}
              className="home-live-card"
              href={currentLivePath}
              key={liveCard.title}
            >
              <Image
                alt=""
                fill
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 20vw"
                src={liveCard.image}
              />
              <div className="home-live-card-meta">
                <span>LIVE</span>
                <small>◉ {liveCard.viewers}</small>
              </div>
              <div className="home-live-card-copy">
                <h3>{liveCard.title}</h3>
                <p>{liveCard.creator}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {homeCategories
        .filter((category) => category.id !== 'all')
        .map((category) => (
          <section
            aria-labelledby={`category-${category.id}-title`}
            className="home-content-section home-category-section"
            id={`category-${category.id}`}
            key={category.id}
          >
            <div className="home-section-heading home-category-section-heading">
              <div>
                <p>{category.subtitle}</p>
                <h2 id={`category-${category.id}-title`}>
                  {category.label} 라이브 <span>LIVE</span>
                </h2>
              </div>
              <a href="#categories">카테고리 보기 ↑</a>
            </div>
            <div className="home-category-live-grid">
              {getHomeCatalogLives(category.id).map((live) => (
                <Link
                  aria-label={`${live.title} 라이브 보기`}
                  className={`home-category-live-card is-${live.category}`}
                  href={currentLivePath}
                  key={live.id}
                >
                  <div className="home-category-live-thumbnail" aria-hidden="true">
                    <span>LIVE / {live.category.toUpperCase()}</span>
                    <strong>{live.thumbnail}</strong>
                    <i>● ON AIR</i>
                  </div>
                  <div className="home-category-live-copy">
                    <div>
                      <span>LIVE NOW</span>
                      <small>◉ {live.viewers}</small>
                    </div>
                    <h3>{live.title}</h3>
                    <p>{live.creator}</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ))}

      <section className="home-content-section home-bento" id="schedule">
        <article className="home-schedule-panel">
          <div className="home-panel-heading">
            <h2>오늘의 라이브 일정</h2>
            <span>데모 방송 일정</span>
          </div>
          <div className="home-schedule-list">
            {schedules.map((schedule) => (
              <article className="home-schedule-row" key={schedule.time}>
                <div className="home-schedule-time">
                  <strong>{schedule.time}</strong>
                  <span>PM</span>
                </div>
                <div>
                  <h3>{schedule.title}</h3>
                  <p>{schedule.host}</p>
                </div>
                <span className="home-schedule-action">알림받기</span>
              </article>
            ))}
          </div>
        </article>

        <aside className="home-recommendation-panel">
          <div className="home-panel-heading home-ai-heading">
            <span aria-hidden="true">✦</span>
            <div>
              <h2>AI 맞춤 추천</h2>
              <p>당신을 위한 큐레이션</p>
            </div>
          </div>
          <div className="home-recommendation-list">
            {recommendations.map((recommendation) => (
              <Link href={currentLivePath} key={recommendation.title}>
                <Image alt="" fill sizes="80px" src={recommendation.image} />
                <div>
                  <span>{recommendation.match}</span>
                  <h3>{recommendation.title}</h3>
                  <p>{recommendation.note}</p>
                </div>
              </Link>
            ))}
          </div>
          <Link className="home-recommendation-more" href={currentLivePath}>
            맞춤 추천 더 보기
          </Link>
        </aside>
      </section>

      <section className="home-subscribe-panel">
        <h2>라이브 쇼핑의 새로운 물결</h2>
        <p>좋아하는 크리에이터의 소식과 한정판 드롭 정보를 가장 먼저 확인하세요.</p>
        <div>
          <Link href={currentLivePath}>라이브 둘러보기</Link>
          <Link href="/admin/lives">방송 운영하기</Link>
        </div>
      </section>

      <footer className="home-footer">
        <div>
          <strong>LiveFlow</strong>
          <p>실시간 스트리밍과 데이터 기반 쇼핑 경험을 연결하는 라이브커머스 데모입니다.</p>
        </div>
        <div className="home-footer-links">
          <a href="#live-now">Live</a>
          <a href="#schedule">Schedule</a>
          <Link href={currentLivePath}>Viewer</Link>
          <Link href="/admin/lives">Operator</Link>
        </div>
        <small>© 2026 LiveFlow. All rights reserved.</small>
      </footer>

      <Link aria-label="방송 운영하기" className="home-fab" href="/admin/lives">
        ▣
      </Link>
    </main>
  );
}
