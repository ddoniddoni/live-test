import { AdminRoom } from './admin-room';

export default async function AdminLivePage({ params }: { params: Promise<{ liveId: string }> }) {
  const { liveId } = await params;
  return <AdminRoom liveId={liveId} />;
}
