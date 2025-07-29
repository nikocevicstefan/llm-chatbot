import express, { Request, Response } from 'express';
import { SlackEventSchema, TelegramUpdateSchema } from '../schemas/webhooks';
import '../types/express';
import {
  validateTelegramUpdate,
  verifySlackSignature,
  verifyTelegramBotTokenSignature
} from '../utils/webhook-verification';
import { AIService } from '../services/ai-service';
import { messageQueue } from '../queue/queue-manager';

const router = express.Router();

// Initialize AI service for health checks
const aiService = AIService.createFromConfig();

// Telegram webhook endpoint
router.post('/telegram', async (req: Request, res: Response): Promise<void> => {
  try {
    // Verify webhook authenticity
    if (!req.rawBody) {
      console.error('No raw body available for Telegram webhook verification');
      res.status(400).json({ error: 'Invalid request' });
      return;
    }

    // Method 1: Check secret token if configured (preferred)
    const secretToken = req.headers['x-telegram-bot-api-secret-token'] as string;
    if (process.env.TELEGRAM_WEBHOOK_SECRET) {
      if (secretToken !== process.env.TELEGRAM_WEBHOOK_SECRET) {
        console.error('Invalid Telegram webhook secret token');
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      console.log('✅ Telegram secret token verified');
    } else {
      // Method 2: Bot token HMAC verification (fallback for your current setup)
      const telegramSignature = req.headers['x-telegram-signature'] as string;
      if (!verifyTelegramBotTokenSignature(req.rawBody, telegramSignature)) {
        console.error('Invalid Telegram bot token signature');
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      if (telegramSignature) {
        console.log('✅ Telegram bot token HMAC verified');
      } else {
        console.log('⚠️  Telegram webhook accepted without signature verification');
      }
    }

    // Validate basic structure
    if (!validateTelegramUpdate(req.rawBody)) {
      console.error('Invalid Telegram webhook data structure');
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Parse and validate webhook data
    const parseResult = TelegramUpdateSchema.safeParse(req.body);
    if (!parseResult.success) {
      console.error('Invalid Telegram webhook data:', parseResult.error);
      res.status(400).json({ error: 'Invalid webhook data' });
      return;
    }

    const update = parseResult.data;

    // Log the received message
    console.log('📱 Telegram webhook received:', {
      updateId: update.update_id,
      messageId: update.message?.message_id,
      from: update.message?.from?.username || update.message?.from?.first_name,
      chat: update.message?.chat?.type,
      text: update.message?.text?.substring(0, 100) + (update.message?.text && update.message.text.length > 100 ? '...' : ''),
      timestamp: new Date().toISOString()
    });

    // Process message with AI if it's a text message
    if (update.message?.text && update.message?.chat?.id) {
      console.log('🔄 Queuing Telegram message for AI processing...');
      
      // Queue message for background processing
      try {
        await messageQueue.add('process-message', {
          platform: 'telegram',
          messageData: {
            text: update.message.text,
            channelId: update.message.chat.id.toString(),
            messageId: update.message.message_id?.toString(),
            metadata: {
              chat_type: update.message.chat.type,
              from_username: update.message.from?.username,
              from_first_name: update.message.from?.first_name,
            }
          },
          conversationId: update.message.chat.id.toString(),
          userId: update.message.from?.id?.toString() || 'unknown',
          timestamp: new Date()
        }, {
          priority: 10, // Normal priority
          delay: 0,     // Process immediately
        });
        
        console.log('✅ Telegram message queued successfully');
      } catch (error) {
        console.error('❌ Failed to queue Telegram message:', error);
      }
    }

    // Acknowledge webhook immediately (Telegram expects response within 3 seconds)
    res.status(200).json({ ok: true });

  } catch (error) {
    console.error('Error processing Telegram webhook:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Slack webhook endpoint
router.post('/slack', async (req: Request, res: Response): Promise<void> => {
  try {
    // Verify we have raw body for signature verification
    if (!req.rawBody) {
      console.error('No raw body available for Slack signature verification');
      res.status(400).json({ error: 'Invalid request' });
      return;
    }

    // Verify Slack signature
    const timestamp = req.headers['x-slack-request-timestamp'] as string;
    const signature = req.headers['x-slack-signature'] as string;

    if (!timestamp || !signature) {
      console.error('Missing Slack signature headers');
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (!verifySlackSignature(req.rawBody, timestamp, signature)) {
      console.error('Invalid Slack signature');
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Parse and validate webhook data
    const parseResult = SlackEventSchema.safeParse(req.body);
    if (!parseResult.success) {
      console.error('Invalid Slack webhook data:', parseResult.error);
      res.status(400).json({ error: 'Invalid webhook data' });
      return;
    }

    const event = parseResult.data;

    // Handle URL verification challenge
    if (event.type === 'url_verification') {
      console.log('🔗 Slack URL verification challenge received');
      res.status(200).json({ challenge: event.challenge });
      return;
    }

    // Handle event callbacks
    if (event.type === 'event_callback' && event.event) {
      // Log the received event
      console.log('📱 Slack webhook received:', {
        type: event.event.type,
        channel: event.event.channel,
        user: event.event.user,
        text: event.event.text?.substring(0, 100) + (event.event.text && event.event.text.length > 100 ? '...' : ''),
        timestamp: new Date().toISOString()
      });

      // Ignore bot messages to prevent loops
      if (event.event && event.event.type === 'message' && event.event.user && event.event.text) {
        console.log('🔄 Queuing Slack message for AI processing...');
        
        // Queue message for background processing
        try {
          await messageQueue.add('process-message', {
            platform: 'slack',
            messageData: {
              text: event.event.text,
              channelId: event.event.channel!,
              messageId: event.event.ts,
              metadata: {
                team: event.team_id,
              }
            },
            conversationId: event.event.channel!,
            userId: event.event.user,
            timestamp: new Date()
          }, {
            priority: 10, // Normal priority
            delay: 0,     // Process immediately
          });
          
          console.log('✅ Slack message queued successfully');
        } catch (error) {
          console.error('❌ Failed to queue Slack message:', error);
        }
      }
    }

    // Acknowledge webhook immediately (Slack expects response within 3 seconds)
    res.status(200).json({ ok: true });

  } catch (error) {
    console.error('Error processing Slack webhook:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Health check for webhooks
router.get('/health', async (_req: Request, res: Response) => {
  try {
    const aiHealth = await aiService.isHealthy();
    
    res.status(200).json({
      status: 'ok',
      endpoints: {
        telegram: '/webhook/telegram',
        slack: '/webhook/slack'
      },
      environment: {
        telegram_configured: !!process.env.TELEGRAM_BOT_TOKEN,
        slack_configured: !!process.env.SLACK_SIGNING_SECRET,
        openai_configured: !!process.env.OPENAI_API_KEY,
        selfhosted_configured: !!(process.env.SELFHOSTED_API_KEY && process.env.SELFHOSTED_BASE_URL),
        fallback_openai_configured: !!process.env.FALLBACK_OPENAI_API_KEY,
        fallback_selfhosted_configured: !!(process.env.FALLBACK_SELFHOSTED_API_KEY && process.env.FALLBACK_SELFHOSTED_BASE_URL)
      },
      ai_service: aiHealth
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: 'Failed to check AI service health'
    });
  }
});

export default router;