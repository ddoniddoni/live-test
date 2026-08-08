'use client';

import { AiEvaluationDashboard } from '@/components/ai-evaluation-dashboard';
import { AdminSessionGate } from '@/app/admin/admin-session-gate';

export default function AdminAiEvaluationsPage() {
  return (
    <AdminSessionGate>
      {(accessToken) => <AiEvaluationDashboard accessToken={accessToken} />}
    </AdminSessionGate>
  );
}
