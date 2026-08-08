import { AdminSessionGate } from '@/app/admin/admin-session-gate';

import { AdminLiveManager } from './admin-live-manager';

type AdminLivesPageProps = {
  searchParams: Promise<{ edit?: string | string[] }>;
};

export default async function AdminLivesPage({ searchParams }: AdminLivesPageProps) {
  const { edit } = await searchParams;
  const initialEditLiveId = typeof edit === 'string' ? edit : undefined;

  return (
    <AdminSessionGate>
      {(accessToken) => (
        <AdminLiveManager
          accessToken={accessToken}
          {...(initialEditLiveId ? { initialEditLiveId } : {})}
        />
      )}
    </AdminSessionGate>
  );
}
