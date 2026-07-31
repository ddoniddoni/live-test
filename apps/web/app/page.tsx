import Link from 'next/link';

const capabilities = [
  {
    title: 'Viewer experience',
    description: '라이브 상품, 채팅, 쿠폰, 주문, AI Q&A를 하나의 흐름으로 보여줍니다.',
  },
  {
    title: 'Admin control room',
    description: '운영자가 방송, 상품, 쿠폰, 채팅, AI 제안을 안전하게 통제합니다.',
  },
  {
    title: 'Reliable realtime',
    description: '서버 영속화, event sequence, dedupe, reconnect recovery를 기준으로 설계합니다.',
  },
] as const;

export default function Home() {
  return (
    <main>
      <section className="hero" aria-labelledby="page-title">
        <p className="eyebrow">PORTFOLIO MVP · PHASE 0</p>
        <h1 id="page-title">LiveFlow</h1>
        <p className="summary">
          사용자 라이브 쇼핑 화면과 운영자 컨트롤룸을 실시간으로 연결하는 AI 기반 라이브커머스
          데모입니다.
        </p>
        <p className="status" role="status">
          실시간 상품 노출 흐름을 준비했습니다.
        </p>
        <div className="hero-actions">
          <Link className="primary-link" href="/live/demo">
            시청자 데모 열기
          </Link>
          <Link className="secondary-link" href="/admin/lives/demo">
            운영자 컨트롤룸
          </Link>
        </div>
      </section>

      <section className="capabilities" aria-label="프로젝트 핵심 역량">
        {capabilities.map((capability) => (
          <article className="capability" key={capability.title}>
            <h2>{capability.title}</h2>
            <p>{capability.description}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
