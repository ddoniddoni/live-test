'use client';

import { AdminSessionGate } from '@/app/admin/admin-session-gate';

import { AdminLiveManager } from './admin-live-manager';

export default function AdminLivesPage() {
  return (
    <AdminSessionGate>
      {(accessToken) => <AdminLiveManager accessToken={accessToken} />}
    </AdminSessionGate>
  );
}
