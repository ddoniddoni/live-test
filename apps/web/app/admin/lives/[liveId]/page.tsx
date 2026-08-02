import { AdminAccessGate } from './admin-access-gate';

export default async function AdminLivePage({ params }: { params: Promise<{ liveId: string }> }) {
  const { liveId } = await params;
  return <AdminAccessGate liveId={liveId} />;
}
