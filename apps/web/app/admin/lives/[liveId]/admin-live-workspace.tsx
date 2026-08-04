'use client';

import { useQuery } from '@tanstack/react-query';
import type { AdminLiveSession } from '@liveflow/contracts';

import { ScreenState } from '@/components/screen-state';
import { adminLiveQueryKey, fetchAdminLive } from '@/lib/live-api';

import { AdminRoom } from './admin-room';
import { BroadcastPreparationPanel } from './broadcast-preparation-panel';

type AdminLiveWorkspaceProps = {
  accessToken: string;
  liveId: string;
};

function getCancelledMessage(live: AdminLiveSession): string {
  return `“${live.title}” 방송은 취소되어 컨트롤룸을 열 수 없습니다.`;
}

export function AdminLiveWorkspace({ accessToken, liveId }: AdminLiveWorkspaceProps) {
  const liveQuery = useQuery({
    queryKey: adminLiveQueryKey(liveId),
    queryFn: () => fetchAdminLive(liveId, accessToken),
  });

  if (liveQuery.isPending) {
    return <ScreenState>방송 준비 정보를 불러오는 중입니다…</ScreenState>;
  }

  if (liveQuery.isError || !liveQuery.data) {
    return (
      <ScreenState tone="error">
        방송 정보를 불러오지 못했습니다. 방송 목록으로 돌아가 다시 시도해 주세요.
      </ScreenState>
    );
  }

  if (liveQuery.data.status === 'DRAFT' || liveQuery.data.status === 'SCHEDULED') {
    return <BroadcastPreparationPanel accessToken={accessToken} live={liveQuery.data} />;
  }

  if (liveQuery.data.status === 'CANCELLED') {
    return <ScreenState tone="error">{getCancelledMessage(liveQuery.data)}</ScreenState>;
  }

  return <AdminRoom accessToken={accessToken} liveId={liveId} />;
}
