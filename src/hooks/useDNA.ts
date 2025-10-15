import { useState, useEffect, useRef, useCallback } from 'react';
import { DEFAULT_DNA, DNA, Answers } from '../types/dna';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL!,
  import.meta.env.VITE_SUPABASE_ANON_KEY!
);

/**
 * useDNA hook: Manages DNA state with debounced sync to backend
 * - Instant UI updates (< 100ms)
 * - Debounced save to dna_sessions (1.2s)
 * - Sync save before generation
 */
export function useDNA(sessionKey: string, initialDNA?: DNA) {
  const [dna, setDna] = useState<DNA>(initialDNA || DEFAULT_DNA);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncedDna, setLastSyncedDna] = useState<DNA>(dna);

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const answersRef = useRef<Answers | null>(null);
  const freeTextRef = useRef<string | null>(null);
  const geminiTagsRef = useRef<string[] | null>(null);

  /**
   * Sync DNA to backend
   */
  const syncToBackend = useCallback(
    async (dnaToSync: DNA, immediate = false) => {
      try {
        setIsSyncing(true);

        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

        if (sessionError || !sessionData.session) {
          console.warn('[useDNA] No active session, skipping sync');
          return;
        }

        const token = sessionData.session.access_token;

        const response = await fetch('/api/dna/sync', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            sessionKey,
            answers: answersRef.current,
            freeText: freeTextRef.current,
            geminiTags: geminiTagsRef.current,
            dna: dnaToSync,
            promptPreview: null,
          }),
        });

        if (!response.ok) {
          console.error('[useDNA] Sync failed:', await response.text());
        } else {
          console.log('[useDNA] Synced DNA to backend', { immediate });
          setLastSyncedDna(dnaToSync);
        }
      } catch (error) {
        console.error('[useDNA] Sync error:', error);
      } finally {
        setIsSyncing(false);
      }
    },
    [sessionKey]
  );

  /**
   * Update DNA (instant UI, debounced save)
   */
  const updateDNA = useCallback(
    (newDna: DNA | ((prev: DNA) => DNA)) => {
      setDna((prev) => {
        const nextDna = typeof newDna === 'function' ? newDna(prev) : newDna;

        // Clear existing debounce timer
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
        }

        // Set new debounce timer (1.2s)
        debounceTimerRef.current = setTimeout(() => {
          syncToBackend(nextDna, false);
        }, 1200);

        return nextDna;
      });
    },
    [syncToBackend]
  );

  /**
   * Force immediate sync (use before generation)
   */
  const syncNow = useCallback(async () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    await syncToBackend(dna, true);
  }, [dna, syncToBackend]);

  /**
   * Update context (answers, freeText, geminiTags)
   */
  const updateContext = useCallback(
    (context: {
      answers?: Answers;
      freeText?: string;
      geminiTags?: string[];
    }) => {
      if (context.answers) answersRef.current = context.answers;
      if (context.freeText !== undefined) freeTextRef.current = context.freeText;
      if (context.geminiTags) geminiTagsRef.current = context.geminiTags;
    },
    []
  );

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  return {
    dna,
    updateDNA,
    syncNow,
    updateContext,
    isSyncing,
    isDirty: JSON.stringify(dna) !== JSON.stringify(lastSyncedDna),
  };
}
