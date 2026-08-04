import type { ReactNode } from 'react';

import { AdminSessionProvider } from './admin-session-provider';

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <AdminSessionProvider>{children}</AdminSessionProvider>;
}
