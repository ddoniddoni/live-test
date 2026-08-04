import { redirect } from 'next/navigation';

import { fetchCurrentLive } from '@/lib/live-api';

import { LiveViewer } from './live-viewer';

export default async function LivePage({ params }: { params: Promise<{ liveId: string }> }) {
  const { liveId } = await params;

  if (liveId === 'demo') {
    let currentLive = null;

    try {
      currentLive = await fetchCurrentLive();
    } catch {
      // The legacy demo replay remains available when the current-live lookup is unavailable.
    }

    if (currentLive && currentLive.id !== liveId) {
      redirect(`/live/${currentLive.id}`);
    }
  }

  return <LiveViewer liveId={liveId} />;
}
