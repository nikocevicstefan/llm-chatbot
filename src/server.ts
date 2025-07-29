import cors from 'cors';
import dotenv from 'dotenv';
import express, { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { createRawBodyCapture } from './middleware/raw-body-capture';
import './queue/message-processor'; // Initialize queue processing
import { messageQueue } from './queue/queue-manager';
import webhookRoutes from './routes/webhooks';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());
app.use(cors());

// Secure raw body capture for webhook signature verification
app.use(createRawBodyCapture({
  limit: 512 * 1024, // 512KB limit for webhooks (reasonable for Telegram/Slack)
  timeout: 5000,      // 5 second timeout (webhooks should be fast)
  encoding: 'utf8'
}));

// Body parsing middleware for non-webhook routes
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/webhook', webhookRoutes);

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Queue/Redis health check endpoint
app.get('/health/queue', async (_req: Request, res: Response) => {
  try {
    const [waiting, active, completed, failed] = await Promise.all([
      messageQueue.getWaiting(),
      messageQueue.getActive(),
      messageQueue.getCompleted(),
      messageQueue.getFailed(),
    ]);

    const isHealthy = waiting.length < 100 && active.length < 20;
    
    res.status(isHealthy ? 200 : 503).json({
      status: isHealthy ? 'healthy' : 'degraded',
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({ 
      status: 'error', 
      error: 'Queue connection failed',
      timestamp: new Date().toISOString()
    });
  }
});

// Basic route for testing
app.get('/', (_req: Request, res: Response) => {
  res.json({
    message: 'AI Chatbot Server Running',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      webhooks: {
        telegram: '/webhook/telegram',
        slack: '/webhook/slack',
        health: '/webhook/health'
      }
    }
  });
});

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not Found',
    message: 'The requested resource was not found'
  });
});

// Error handling middleware
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Error:', err.message);
  console.error('Stack:', err.stack);

  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'production'
      ? 'Something went wrong'
      : err.message
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
});

export default app;