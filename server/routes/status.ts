import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

export const statusRoutes = Router();

// GET /api/status/[id] - Polling endpoint
statusRoutes.get('/status/:id', async (req, res) => {
  const prisma: PrismaClient = (req as any).prisma;
  
  try {
    const { id } = req.params;
    
    const job = await prisma.generationJob.findUnique({
      where: { id },
      include: { images: true }
    });
    
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    
    res.json({
      id: job.id,
      status: job.status,
      progress: job.progress,
      resultUrls: job.resultUrls,
      error: job.error,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt
    });
    
  } catch (error: any) {
    console.error('[Status API Error]:', error);
    res.status(500).json({ 
      error: 'Failed to get job status',
      message: error.message 
    });
  }
});

// GET /api/status/stream?id=... - SSE endpoint
statusRoutes.get('/status/stream', async (req, res) => {
  const prisma: PrismaClient = (req as any).prisma;
  const jobId = req.query.id as string;
  
  if (!jobId) {
    return res.status(400).json({ error: 'Job ID is required' });
  }
  
  // Setup SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': 'http://localhost:5173',
    'Access-Control-Allow-Credentials': 'true'
  });
  
  // Send initial connection event
  res.write(`event: connect\ndata: {"message": "Connected to job ${jobId}"}\n\n`);
  
  let pollInterval: NodeJS.Timeout;
  let isCompleted = false;
  
  const pollStatus = async () => {
    try {
      const job = await prisma.generationJob.findUnique({
        where: { id: jobId },
        include: { images: true }
      });
      
      if (!job) {
        res.write(`event: error\ndata: {"error": "Job not found"}\n\n`);
        res.end();
        return;
      }
      
      // Send progress update
      res.write(`event: progress\ndata: ${JSON.stringify({
        status: job.status,
        progress: job.progress,
        updatedAt: job.updatedAt
      })}\n\n`);
      
      // Check if job is completed
      if (['completed', 'failed', 'timeout', 'canceled'].includes(job.status)) {
        isCompleted = true;
        
        if (job.status === 'completed') {
          res.write(`event: complete\ndata: ${JSON.stringify({
            urls: job.resultUrls,
            images: job.images
          })}\n\n`);
        } else {
          res.write(`event: error\ndata: ${JSON.stringify({
            status: job.status,
            error: job.error
          })}\n\n`);
        }
        
        // Close connection after a short delay
        setTimeout(() => {
          res.end();
        }, 1000);
        
        if (pollInterval) {
          clearInterval(pollInterval);
        }
      }
      
    } catch (error: any) {
      console.error('[SSE Poll Error]:', error);
      res.write(`event: error\ndata: ${JSON.stringify({ error: error.message })}\n\n`);
      res.end();
      
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    }
  };
  
  // Start polling every 1.5 seconds
  pollInterval = setInterval(pollStatus, 1500);
  
  // Initial poll
  pollStatus();
  
  // Handle client disconnect
  req.on('close', () => {
    if (pollInterval) {
      clearInterval(pollInterval);
    }
  });
  
  req.on('end', () => {
    if (pollInterval) {
      clearInterval(pollInterval);
    }
  });
});