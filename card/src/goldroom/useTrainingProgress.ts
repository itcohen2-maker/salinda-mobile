// ============================================================
// useTrainingProgress — persists which Gold Room tasks are done.
// Keyed by task id (NOT a positional array) so the catalog can be
// reordered/extended without shifting saved progress. Persisted via
// AsyncStorage (works on web + native in this app).
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'gold_room_progress_v1';

export function useTrainingProgress() {
  const [completed, setCompleted] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (active && raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object') setCompleted(parsed as Record<string, boolean>);
        }
      } catch {
        // Corrupt/missing storage — start fresh, no crash.
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const markComplete = useCallback((id: string) => {
    setCompleted((prev) => {
      if (prev[id]) return prev;
      const next = { ...prev, [id]: true };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {
        // best-effort persist; in-memory state already updated
      });
      return next;
    });
  }, []);

  const isComplete = useCallback((id: string) => !!completed[id], [completed]);

  return { completed, isComplete, markComplete, loading };
}
