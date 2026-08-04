'use client';

import { AdminSessionGate } from '@/app/admin/admin-session-gate';
import { AdminLiveManager } from '@/app/admin/lives/admin-live-manager';

export default function NewAdminLivePage() {
  return (
    <AdminSessionGate>
      {(accessToken) => <AdminLiveManager accessToken={accessToken} initialCreate />}
    </AdminSessionGate>
  );
}
