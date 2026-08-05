import Link from 'next/link';
import { redirect } from 'next/navigation';

import { ScreenState } from '@/components/screen-state';
import { fetchCurrentLive } from '@/lib/live-api';

export default async function CurrentLivePage() {
  try {
    const live = await fetchCurrentLive();

    if (live) {
      redirect(`/live/${live.id}`);
    }
  } catch {
    return (
      <ScreenState
        actions={
          <>
            <Link href="/live?retry=1">다시 시도</Link>
            <Link href="/">홈으로</Link>
            <Link href="/admin">운영자 화면</Link>
          </>
        }
        tone="error"
      >
        현재 라이브 방송 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.
      </ScreenState>
    );
  }

  return (
    <ScreenState
      actions={
        <>
          <Link href="/">홈으로</Link>
          <Link href="/admin">운영자 화면</Link>
        </>
      }
    >
      현재 진행 중인 라이브가 없습니다.
    </ScreenState>
  );
}
