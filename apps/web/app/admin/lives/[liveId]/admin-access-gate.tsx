'use client';

import { AdminSessionGate } from '@/app/admin/admin-session-gate';

import { AdminLiveWorkspace } from './admin-live-workspace';

export function AdminAccessGate({ liveId }: { liveId: string }) {
  return (
    <AdminSessionGate>
      {(accessToken) => <AdminLiveWorkspace accessToken={accessToken} liveId={liveId} />}
    </AdminSessionGate>
  );
}
