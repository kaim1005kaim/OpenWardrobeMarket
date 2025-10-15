import { useEffect, useRef, useState } from 'react';

/**
 * Robust image display hook with proper blob lifecycle management
 * 1. Shows blobUrl immediately
 * 2. Preloads finalUrl in background
 * 3. Switches to finalUrl when loaded successfully
 * 4. Only revokes blob after successful switch
 */
export function useDisplayImage({
  blobUrl,
  finalUrl
}: {
  blobUrl?: string;
  finalUrl?: string | null;
}) {
  const [src, setSrc] = useState<string | undefined>(undefined);
  const revokeRef = useRef<(() => void) | null>(null);

  // 1) Show blob immediately
  useEffect(() => {
    if (!blobUrl) return;

    console.info('[useDisplayImage] Setting blob URL', {
      blobUrl,
      isBlob: blobUrl.startsWith('blob:'),
      timestamp: Date.now()
    });

    setSrc(blobUrl);

    // Prepare revoke function, but don't call yet
    revokeRef.current = () => {
      try {
        console.info('[useDisplayImage] Revoking blob URL', { blobUrl });
        URL.revokeObjectURL(blobUrl);
      } catch (e) {
        console.warn('[useDisplayImage] Failed to revoke blob', e);
      }
    };
  }, [blobUrl]);

  // 2) Preload finalUrl in background and switch when ready
  useEffect(() => {
    if (!finalUrl || finalUrl === blobUrl) return;

    console.info('[useDisplayImage] Starting finalUrl preload', { finalUrl });

    let cancelled = false;
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      if (cancelled) return;

      console.info('[useDisplayImage] finalUrl loaded successfully', { finalUrl });

      // Switch to finalUrl
      setSrc(finalUrl);

      // Now safe to revoke blob
      revokeRef.current?.();
      revokeRef.current = null;
    };

    img.onerror = (e) => {
      if (cancelled) return;

      console.error('[useDisplayImage] finalUrl failed to load', {
        finalUrl,
        error: e
      });

      // Keep using blob as fallback
      // Don't revoke blob since we need it
    };

    // Add cache bust for slow R2 propagation
    const cacheBust = finalUrl.includes('?') ? '&' : '?';
    img.src = `${finalUrl}${cacheBust}v=${Date.now()}`;

    // Verify with HEAD request
    fetch(finalUrl, { method: 'HEAD', cache: 'no-store' })
      .then(r => {
        console.info('[useDisplayImage HEAD]', {
          url: finalUrl,
          status: r.status,
          contentType: r.headers.get('content-type'),
          headers: Array.from(r.headers.entries())
        });
      })
      .catch(e => console.warn('[useDisplayImage HEAD error]', e));

    return () => {
      cancelled = true;
    };
  }, [finalUrl, blobUrl]);

  // 3) Cleanup on unmount
  useEffect(() => {
    return () => {
      revokeRef.current?.();
    };
  }, []);

  return { src };
}
