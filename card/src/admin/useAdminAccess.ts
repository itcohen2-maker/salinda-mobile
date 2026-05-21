import { useEffect, useState } from 'react';

import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';

export interface UseAdminAccessResult {
  isAdmin: boolean;
  loading: boolean;
}

export function useAdminAccess(): UseAdminAccessResult {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    if (!user?.id) {
      setIsAdmin(false);
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }

    setLoading(true);
    void (async () => {
      try {
        const { data, error } = await supabase
          .from('admin_users')
          .select('user_id')
          .eq('user_id', user.id)
          .maybeSingle();

        if (cancelled) return;
        setIsAdmin(!error && !!data?.user_id);
      } catch {
        if (cancelled) return;
        setIsAdmin(false);
      } finally {
        if (cancelled) return;
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  return { isAdmin, loading };
}
