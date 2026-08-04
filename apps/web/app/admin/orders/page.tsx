'use client';

import { Suspense } from 'react';

import { AdminSessionGate } from '@/app/admin/admin-session-gate';

import { AdminOrderManager } from './admin-order-manager';

export default function AdminOrdersPage() {
  return (
    <AdminSessionGate>
      {(accessToken) => (
        <Suspense
          fallback={
            <main className="admin-live-manager-shell">
              <p className="admin-session-loading" role="status">
                주문 관리 화면을 준비하는 중입니다…
              </p>
            </main>
          }
        >
          <AdminOrderManager accessToken={accessToken} />
        </Suspense>
      )}
    </AdminSessionGate>
  );
}
