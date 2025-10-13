import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { generateRoutes } from './routes/generate';
import { statusRoutes } from './routes/status';
import { trendsRoutes } from './routes/trends';
import { router as nanoBananaRoutes } from './routes/nanobanana';
import composePosterRoutes from './routes/compose-poster';

const app = express();
const port = process.env.PORT || 3001;
const prisma = new PrismaClient();

// Middleware
app.use(cors({
  origin: 'http://localhost:5173', // Vite dev server
  credentials: true
}));
app.use(express.json());

// Make prisma available in requests
app.use((req, res, next) => {
  (req as any).prisma = prisma;
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api', generateRoutes);
app.use('/api', statusRoutes);
app.use('/api', trendsRoutes);
app.use('/api', nanoBananaRoutes);
app.use('/api/compose-poster', composePosterRoutes);

// Error handler
app.use((error: any, req: any, res: any, next: any) => {
  console.error('[Server Error]', error);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? error.message : undefined
  });
});

app.listen(port, () => {
  console.log(`🚀 API Server running on http://localhost:${port}`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});