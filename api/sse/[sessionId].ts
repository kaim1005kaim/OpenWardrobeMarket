import type { NextApiRequest, NextApiResponse } from 'next';

// In-memory store for SSE connections (in production, use Redis pub/sub)
const sseConnections = new Map<string, Set<NextApiResponse>>();
const sessionResults = new Map<string, any>();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { sessionId } = req.query as { sessionId: string };

  if (!sessionId) {
    return res.status(400).json({ error: 'Session ID required' });
  }

  console.log('[SSE] Client connected:', sessionId);

  // Set up SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Cache-Control');

  // Add this connection to the session's connection set
  if (!sseConnections.has(sessionId)) {
    sseConnections.set(sessionId, new Set());
  }
  sseConnections.get(sessionId)!.add(res);

  // Send initial connection confirmation
  res.write(`data: ${JSON.stringify({
    type: 'connected',
    sessionId,
    timestamp: Date.now()
  })}\n\n`);

  // If we have cached results, send them immediately
  const cachedResult = sessionResults.get(sessionId);
  if (cachedResult) {
    res.write(`data: ${JSON.stringify(cachedResult)}\n\n`);
    // Clean up cached result
    sessionResults.delete(sessionId);
    // Close connection after sending cached result
    setTimeout(() => {
      cleanupConnection(sessionId, res);
    }, 100);
    return;
  }

  // Handle client disconnect
  req.on('close', () => {
    console.log('[SSE] Client disconnected:', sessionId);
    cleanupConnection(sessionId, res);
  });

  req.on('error', (error) => {
    console.error('[SSE] Connection error:', sessionId, error);
    cleanupConnection(sessionId, res);
  });

  // Keep connection alive with periodic pings
  const pingInterval = setInterval(() => {
    try {
      res.write(`: ping ${Date.now()}\n\n`);
    } catch (error) {
      console.log('[SSE] Ping failed, cleaning up:', sessionId);
      clearInterval(pingInterval);
      cleanupConnection(sessionId, res);
    }
  }, 30000); // 30 second ping

  // Auto-cleanup after 5 minutes
  setTimeout(() => {
    clearInterval(pingInterval);
    cleanupConnection(sessionId, res);
  }, 300000);
}

function cleanupConnection(sessionId: string, res: NextApiResponse) {
  try {
    if (!res.destroyed) {
      res.end();
    }
  } catch (error) {
    // Connection already closed
  }

  const connections = sseConnections.get(sessionId);
  if (connections) {
    connections.delete(res);
    if (connections.size === 0) {
      sseConnections.delete(sessionId);
    }
  }
}

// Export functions for webhook to use
export function broadcastToSession(sessionId: string, data: any) {
  const connections = sseConnections.get(sessionId);
  
  if (!connections || connections.size === 0) {
    // No active connections, cache the result
    console.log('[SSE] No active connections, caching result:', sessionId);
    sessionResults.set(sessionId, data);
    return;
  }

  const deadConnections = new Set<NextApiResponse>();
  
  for (const connection of connections) {
    try {
      connection.write(`data: ${JSON.stringify(data)}\n\n`);
      
      // Close connection after sending final result
      if (data.type === 'completed' || data.type === 'failed') {
        setTimeout(() => {
          cleanupConnection(sessionId, connection);
        }, 1000);
      }
    } catch (error) {
      console.log('[SSE] Failed to write to connection, marking for cleanup:', sessionId);
      deadConnections.add(connection);
    }
  }

  // Clean up dead connections
  for (const deadConnection of deadConnections) {
    cleanupConnection(sessionId, deadConnection);
  }
}

export function getActiveConnections() {
  const stats = Array.from(sseConnections.entries()).map(([sessionId, connections]) => ({
    sessionId,
    connectionCount: connections.size
  }));
  
  return {
    totalSessions: sseConnections.size,
    totalConnections: Array.from(sseConnections.values()).reduce((sum, set) => sum + set.size, 0),
    sessions: stats
  };
}

// Make functions available globally for webhook handler
if (typeof global !== 'undefined') {
  global.broadcastToSession = broadcastToSession;
  global.getSSEStats = getActiveConnections;
}