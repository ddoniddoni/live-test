import { LiveViewer } from './live-viewer';

export default async function LivePage({ params }: { params: Promise<{ liveId: string }> }) {
  const { liveId } = await params;
  return <LiveViewer liveId={liveId} />;
}
