import { useRef, useCallback } from 'react';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

interface CacheOptions {
  ttl?: number; // Time to live in milliseconds (デフォルト: 5分)
}

/**
 * データキャッシング用hook
 * APIレスポンスをキャッシュして、重複リクエストを防ぐ
 */
export function useDataCache<T>(options: CacheOptions = {}) {
  const { ttl = 5 * 60 * 1000 } = options; // デフォルト5分
  const cacheRef = useRef<Map<string, CacheEntry<T>>>(new Map());

  const get = useCallback(
    (key: string): T | null => {
      const entry = cacheRef.current.get(key);
      if (!entry) return null;

      // TTL チェック
      const age = Date.now() - entry.timestamp;
      if (age > ttl) {
        cacheRef.current.delete(key);
        return null;
      }

      return entry.data;
    },
    [ttl]
  );

  const set = useCallback((key: string, data: T) => {
    cacheRef.current.set(key, {
      data,
      timestamp: Date.now(),
    });
  }, []);

  const clear = useCallback((key?: string) => {
    if (key) {
      cacheRef.current.delete(key);
    } else {
      cacheRef.current.clear();
    }
  }, []);

  const has = useCallback(
    (key: string): boolean => {
      const entry = cacheRef.current.get(key);
      if (!entry) return false;

      const age = Date.now() - entry.timestamp;
      if (age > ttl) {
        cacheRef.current.delete(key);
        return false;
      }

      return true;
    },
    [ttl]
  );

  return { get, set, clear, has };
}
