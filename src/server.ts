import cors from 'cors';
import dotenv from 'dotenv';
import express, { NextFunction, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
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

// Rate limiting configuration
const generalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000'), // 1 minute default
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'), // 100 requests per window
  message: {
    error: 'Too many requests',
    message: 'Rate limit exceeded. Please try again later.'
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// Webhook-specific rate limiting (more restrictive)
const webhookLimiter = rateLimit({
  windowMs: 60000, // 1 minute
  max: 50, // 50 webhook requests per minute per IP
  message: {
    error: 'Webhook rate limit exceeded',
    message: 'Too many webhook requests. Please slow down.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply general rate limiting to all routes
app.use(generalLimiter);

// Secure raw body capture for webhook signature verification
app.use(createRawBodyCapture({
  limit: 512 * 1024, // 512KB limit for webhooks (reasonable for Telegram/Slack)
  timeout: 5000,      // 5 second timeout (webhooks should be fast)
  encoding: 'utf8'
}));

// Body parsing middleware for non-webhook routes (reduced limits for security)
app.use(express.json({ limit: '1mb' })); // Reduced from 10mb to 1mb
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Routes with webhook-specific rate limiting
app.use('/webhook', webhookLimiter, webhookRoutes);

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

// Error handling middleware - sanitized for security
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  // Log detailed error information for debugging (server-side only)
  console.error('Error:', err.message);
  console.error('Stack:', err.stack);

  // Always return generic error message to prevent information disclosure
  res.status(500).json({
    error: 'Internal Server Error',
    message: 'An unexpected error occurred. Please try again later.',
    timestamp: new Date().toISOString()
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
});

export default app;