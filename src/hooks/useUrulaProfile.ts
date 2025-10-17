import { useState, useRef, useCallback, useEffect } from 'react';
import { useAuth } from '../app/lib/AuthContext';
import type { UserUrulaProfile, EvolutionInput } from '../types/urula';
import { DEFAULT_URULA_PROFILE } from '../types/urula';

const FLUSH_DELAY_MS = 2500;
const MAX_QUEUE_SIZE = 5;

interface UseUrulaProfileReturn {
  profile: UserUrulaProfile;
  loading: boolean;
  error: string | null;
  applyLocal: (delta: Partial<UserUrulaProfile>) => void;
  evolve: (input: EvolutionInput) => Promise<void>;
  reload: () => Promise<void>;
  flush: () => Promise<void>;
}

/**
 * Hook for managing user's Urula profile with local-first updates
 * and debounced server persistence
 */
export function useUrulaProfile(): UseUrulaProfileReturn {
  const { user, session } = useAuth();
  const [profile, setProfile] = useState<UserUrulaProfile>({
    ...DEFAULT_URULA_PROFILE,
    user_id: '',
    updated_at: new Date().toISOString(),
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const patchQueue = useRef<Partial<UserUrulaProfile>>({});
  const flushTimer = useRef<number | undefined>();
  const queueCounter = useRef(0);
  const isFlushing = useRef(false);

  /**
   * Flush pending changes to server
   */
  const flush = useCallback(async () => {
    if (isFlushing.current || Object.keys(patchQueue.current).length === 0 || !user || !session) {
      return;
    }

    isFlushing.current = true;
    const delta = { ...patchQueue.current };
    patchQueue.current = {};
    queueCounter.current = 0;

    try {
      const response = await fetch('/api/urula/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify(delta)
      });

      if (!response.ok) {
        throw new Error('Failed to update profile');
      }

      const updated = await response.json();
      setProfile(updated);
      setError(null);
    } catch (err: any) {
      console.error('[useUrulaProfile] Flush error:', err);
      setError(err.message);
      // Re-queue failed changes
      Object.assign(patchQueue.current, delta);
    } finally {
      isFlushing.current = false;
    }
  }, [user, session]);

  /**
   * Apply local changes immediately and schedule server sync
   */
  const applyLocal = useCallback((delta: Partial<UserUrulaProfile>) => {
    // Immediate local update for UI responsiveness
    setProfile(prev => ({
      ...prev,
      ...delta,
      updated_at: new Date().toISOString()
    }));

    // Queue for server sync
    Object.assign(patchQueue.current, delta);
    queueCounter.current++;

    // Clear existing timer
    if (flushTimer.current) {
      clearTimeout(flushTimer.current);
    }

    // Flush immediately if queue is full, otherwise debounce
    if (queueCounter.current >= MAX_QUEUE_SIZE) {
      flush();
    } else {
      flushTimer.current = window.setTimeout(flush, FLUSH_DELAY_MS);
    }
  }, [flush]);

  /**
   * Evolve profile based on generation result
   */
  const evolve = useCallback(async (input: EvolutionInput) => {
    if (!user || !session) return;

    try {
      const response = await fetch('/api/urula/evolve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify(input)
      });

      if (!response.ok) {
        throw new Error('Failed to evolve profile');
      }

      const evolved = await response.json();
      setProfile(evolved);
      setError(null);

      // Clear any pending patches since we just got fresh data
      patchQueue.current = {};
      queueCounter.current = 0;
      if (flushTimer.current) {
        clearTimeout(flushTimer.current);
      }
    } catch (err: any) {
      console.error('[useUrulaProfile] Evolve error:', err);
      setError(err.message);
    }
  }, [user, session]);

  /**
   * Reload profile from server
   */
  const reload = useCallback(async () => {
    if (!user || !session) return;

    setLoading(true);
    try {
      const response = await fetch('/api/urula/profile', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch profile');
      }

      const data = await response.json();
      setProfile(data);
      setError(null);

      // Clear pending patches
      patchQueue.current = {};
      queueCounter.current = 0;
      if (flushTimer.current) {
        clearTimeout(flushTimer.current);
      }
    } catch (err: any) {
      console.error('[useUrulaProfile] Reload error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user, session]);

  // Load profile on mount or user change
  useEffect(() => {
    if (user) {
      reload();
    } else {
      setProfile({
        ...DEFAULT_URULA_PROFILE,
        user_id: '',
        updated_at: new Date().toISOString(),
      });
      setLoading(false);
    }
  }, [user, reload]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (flushTimer.current) {
        clearTimeout(flushTimer.current);
      }
    };
  }, []);

  return {
    profile,
    loading,
    error,
    applyLocal,
    evolve,
    reload,
    flush
  };
}
