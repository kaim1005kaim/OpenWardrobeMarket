import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { PrismaClient } from '@prisma/client';
import { processGeneration } from '../services/imagineApi';

export const generateRoutes = Router();

// POST /api/generate
generateRoutes.post('/generate', async (req, res) => {
  const prisma: PrismaClient = (req as any).prisma;
  
  try {
    const { mode, count, params, aspectRatio, idempotencyKey: providedKey } = req.body;
    
    // Validate input
    if (!mode || !['quick', 'pro'].includes(mode)) {
      return res.status(400).json({ error: 'Invalid mode. Must be "quick" or "pro"' });
    }
    
    if (!count || ![4, 6, 9].includes(count)) {
      return res.status(400).json({ error: 'Invalid count. Must be 4, 6, or 9' });
    }
    
    // Get or generate idempotency key
    const idempotencyKey = providedKey || req.headers['x-idempotency-key'] || uuidv4();
    
    if (!idempotencyKey) {
      return res.status(400).json({ error: 'Idempotency key is required' });
    }
    
    // Check for existing job with same idempotency key
    const existingJob = await prisma.generationJob.findUnique({
      where: { idempotencyKey: idempotencyKey as string }
    });
    
    if (existingJob) {
      return res.status(200).json({
        jobId: existingJob.id,
        status: existingJob.status,
        message: 'Job already exists for this idempotency key'
      });
    }
    
    // Create new generation job
    const job = await prisma.generationJob.create({
      data: {
        idempotencyKey: idempotencyKey as string,
        status: 'queued',
        mode,
        params: {
          ...params,
          count,
          aspectRatio: aspectRatio || '3:4'
        }
      }
    });
    
    // Start async processing (don't wait for completion)
    processGeneration(job.id, prisma).catch(error => {
      console.error(`[Generation Error] Job ${job.id}:`, error);
      // Update job status to failed
      prisma.generationJob.update({
        where: { id: job.id },
        data: { 
          status: 'failed', 
          error: { message: error.message, stack: error.stack }
        }
      }).catch(updateError => {
        console.error(`[DB Error] Failed to update job ${job.id}:`, updateError);
      });
    });
    
    // Return immediately with jobId
    res.status(200).json({
      jobId: job.id,
      status: 'queued'
    });
    
  } catch (error: any) {
    console.error('[Generate API Error]:', error);
    res.status(500).json({ 
      error: 'Failed to create generation job',
      message: error.message 
    });
  }
});