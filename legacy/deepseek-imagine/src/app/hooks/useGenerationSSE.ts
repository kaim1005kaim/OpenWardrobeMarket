'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

interface GenerationAsset {
  id: string;
  r2_url: string;
  width?: number;
  height?: number;
  imagine_image_index: number;
}

interface GenerationStatus {
  jobId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  message: string;
  assets?: GenerationAsset[];
  error?: string;
}

interface UseGenerationSSEResult {
  status: GenerationStatus | null;
  isConnected: boolean;
  error: string | null;
  reconnect: () => void;
}

export const useGenerationSSE = (jobId: string | null): UseGenerationSSEResult => {
  const [status, setStatus] = useState<GenerationStatus | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const eventSourceRef = useRef<EventSource | null>(null);

  const cleanup = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setIsConnected(false);
  }, []);

  const connect = useCallback(() => {
    if (!jobId || eventSourceRef.current) {
      return;
    }

    console.log('[SSE] Connecting to generation stream:', jobId);
    setError(null);

    // URLエンコードして特殊文字を処理
    const encodedJobId = encodeURIComponent(jobId);
    const eventSource = new EventSource(`/api/sse/generation/${encodedJobId}`);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      console.log('[SSE] Connected to generation stream');
      setIsConnected(true);
      setError(null);
    };

    eventSource.addEventListener('connected', (event) => {
      console.log('[SSE] Connection confirmed:', event.data);
      const data = JSON.parse(event.data);
      setStatus({
        jobId: data.jobId,
        status: 'pending',
        progress: 0,
        message: 'Connected to generation stream'
      });
    });

    eventSource.addEventListener('status', (event) => {
      console.log('[SSE] Status update:', event.data);
      const data = JSON.parse(event.data);
      setStatus(data);
    });

    eventSource.addEventListener('progress', (event) => {
      console.log('[SSE] Progress update:', event.data);
      const data = JSON.parse(event.data);
      setStatus(prev => ({
        ...prev,
        jobId: data.jobId,
        status: 'processing',
        progress: data.progress,
        message: data.message || `Generating... ${data.progress}%`
      }));
    });

    eventSource.addEventListener('completed', (event) => {
      console.log('[SSE] Generation completed:', event.data);
      const data = JSON.parse(event.data);
      setStatus({
        jobId: data.jobId,
        status: 'completed',
        progress: 100,
        message: data.message || 'Generation completed!',
        assets: data.assets || []
      });
      
      // Close connection after completion
      setTimeout(cleanup, 2000);
    });

    eventSource.addEventListener('failed', (event) => {
      console.log('[SSE] Generation failed:', event.data);
      const data = JSON.parse(event.data);
      setStatus({
        jobId: data.jobId,
        status: 'failed',
        progress: 0,
        message: data.message || 'Generation failed',
        error: data.error
      });
      
      // Close connection after failure
      setTimeout(cleanup, 2000);
    });

    eventSource.addEventListener('ping', (event) => {
      // Ping received, connection is alive
      console.log('[SSE] Ping received');
    });

    eventSource.addEventListener('error', (event: MessageEvent) => {
      console.error('[SSE] Event error:', event);
      const data = JSON.parse(event.data || '{}');
      setError(data.error || 'Stream error occurred');
    });

    eventSource.onerror = (event) => {
      console.error('[SSE] Connection error:', event);
      setIsConnected(false);
      setError('Connection error. EventSource will automatically reconnect.');
    };

  }, [jobId, cleanup]);

  const reconnect = useCallback(() => {
    cleanup();
    if (jobId) {
      setTimeout(connect, 100);
    }
  }, [jobId, connect, cleanup]);

  // Start connection when jobId changes
  useEffect(() => {
    if (jobId) {
      connect();
    }
    
    return cleanup;
  }, [jobId, connect, cleanup]);

  // Cleanup on unmount
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  return {
    status,
    isConnected,
    error,
    reconnect
  };
};