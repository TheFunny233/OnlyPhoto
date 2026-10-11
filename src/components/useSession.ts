'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { apiFetch } from '@/lib/client/api';

export type SessionUser = { id: string; email: string; nickname: string; isDemo: boolean };

export function useSession() {
  const pathname = usePathname();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    apiFetch<{ user: SessionUser | null }>('/api/auth/session')
      .then((data) => {
        if (active) setUser(data.user);
      })
      .catch(() => {
        if (active) setUser(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [pathname]);

  return { user, loading, setUser };
}