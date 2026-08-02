import type { ReactNode } from 'react';

type ScreenStateProps = {
  children: ReactNode;
  tone?: 'error' | 'loading';
};

export function ScreenState({ children, tone = 'loading' }: ScreenStateProps) {
  const isLoading = tone === 'loading';

  return (
    <main
      aria-busy={isLoading}
      className={`screen-state is-${tone}`}
      role={isLoading ? 'status' : 'alert'}
    >
      <div className="screen-state-content">
        <span aria-hidden="true" className="screen-state-mark" />
        <p>{children}</p>
        <small>
          {isLoading
            ? 'LIVEFLOW · 실시간 방송 환경을 준비하고 있습니다'
            : '잠시 후 다시 시도하거나 서버 연결 상태를 확인해 주세요'}
        </small>
      </div>
    </main>
  );
}
