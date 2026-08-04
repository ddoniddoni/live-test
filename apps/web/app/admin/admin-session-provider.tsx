'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';

type AdminSessionContextValue = {
  accessToken: string | null;
  isRestoring: boolean;
  setAccessToken: (accessToken: string) => void;
};

const adminSessionStorageKey = 'liveflow.admin.access-token';
const AdminSessionContext = createContext<AdminSessionContextValue | null>(null);

export function AdminSessionProvider({ children }: { children: ReactNode }) {
  const [accessToken, setAccessTokenState] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState(true);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const storedAccessToken = window.sessionStorage.getItem(adminSessionStorageKey);
      setAccessTokenState(storedAccessToken);
      setIsRestoring(false);
    });

    return () => window.clearTimeout(timeoutId);
  }, []);

  function setAccessToken(nextAccessToken: string): void {
    window.sessionStorage.setItem(adminSessionStorageKey, nextAccessToken);
    setAccessTokenState(nextAccessToken);
  }

  return (
    <AdminSessionContext.Provider value={{ accessToken, isRestoring, setAccessToken }}>
      {children}
    </AdminSessionContext.Provider>
  );
}

export function useAdminSession(): AdminSessionContextValue {
  const context = useContext(AdminSessionContext);

  if (!context) {
    throw new Error('useAdminSession must be used within an AdminSessionProvider.');
  }

  return context;
}
