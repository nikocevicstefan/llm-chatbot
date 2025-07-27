import express, { Request, Response } from 'express';
import { SlackEventSchema, TelegramUpdateSchema } from '../schemas/webhooks';
import '../types/express';
import {
  validateTelegramUpdate,
  verifySlackSignature,
  verifyTelegramBotTokenSignature
} from '../utils/webhook-verification';
import { AIService } from '../services/ai-service';
import { ConversationService } from '../services/conversation-service';

const router = express.Router();

// Initialize AI service
const aiService = AIService.createFromConfig();

// Helper function to send Telegram message
async function sendTelegramMessage(chatId: number, text: string) {
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    console.error('TELEGRAM_BOT_TOKEN not configured');
    return;
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: 'Markdown',
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Failed to send Telegram message:', error);
    }
  } catch (error) {
    console.error('Error sending Telegram message:', error);
  }
}

// Helper function to send Slack message
async function sendSlackMessage(channel: string, text: string) {
  if (!process.env.SLACK_BOT_TOKEN) {
    console.error('SLACK_BOT_TOKEN not configured');
    return;
  }

  try {
    const response = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.SLACK_BOT_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        channel: channel,
        text: text,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Failed to send Slack message:', error);
    }
  } catch (error) {
    console.error('Error sending Slack message:', error);
  }
}

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
      console.log('🔄 Processing Telegram message with AI...');
      
      // Process asynchronously to respond to webhook quickly
      setImmediate(async () => {
        try {
          // Persist user message to database
          const { conversation } = await ConversationService.addUserMessage(
            'telegram',
            update.message!.chat!.id.toString(),
            update.message!.from?.id?.toString() || 'unknown',
            update.message!.text!,
            update.message!.message_id?.toString(),
            {
              chat_type: update.message!.chat!.type,
              from_username: update.message!.from?.username,
              from_first_name: update.message!.from?.first_name,
            }
          );

          // Get conversation history for context
          const conversationHistory = await ConversationService.getConversationHistory(
            conversation.id,
            4000 // max tokens for context
          );
          
          // Format messages for AI
          const formattedMessages = ConversationService.formatMessagesForAI(conversationHistory);
          
          // Process with AI
          const aiResponse = await aiService.processMessage(update.message!.text!, formattedMessages);
          
          // Persist AI response to database
          await ConversationService.addAssistantMessage(
            conversation.id,
            aiResponse.content,
            {
              ...(aiResponse.usage?.totalTokens && { token_count: aiResponse.usage.totalTokens }),
            }
          );

          // Send response to Telegram
          await sendTelegramMessage(update.message!.chat!.id, aiResponse.content);
          console.log('✅ AI response sent to Telegram and persisted to database');
        } catch (error) {
          console.error('❌ Failed to process message with AI:', error);
          await sendTelegramMessage(
            update.message!.chat!.id, 
            'Sorry, I encountered an error processing your message. Please try again later.'
          );
        }
      });
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
        console.log('🔄 Processing Slack message with AI...');
        
        // Process asynchronously to respond to webhook quickly
        setImmediate(async () => {
          try {
            // Persist user message to database
            const { conversation } = await ConversationService.addUserMessage(
              'slack',
              event.event!.channel!,
              event.event!.user!,
              event.event!.text!,
              event.event!.ts,
              {
                team: event.team_id,
              }
            );

            // Get conversation history for context
            const conversationHistory = await ConversationService.getConversationHistory(
              conversation.id,
              4000 // max tokens for context
            );
            
            // Format messages for AI
            const formattedMessages = ConversationService.formatMessagesForAI(conversationHistory);
            
            // Process with AI
            const aiResponse = await aiService.processMessage(event.event!.text!, formattedMessages);
            
            // Persist AI response to database
            await ConversationService.addAssistantMessage(
              conversation.id,
              aiResponse.content,
              {
                ...(aiResponse.usage?.totalTokens && { token_count: aiResponse.usage.totalTokens }),
              }
            );

            // Send response to Slack
            await sendSlackMessage(event.event!.channel!, aiResponse.content);
            console.log('✅ AI response sent to Slack and persisted to database');
          } catch (error) {
            console.error('❌ Failed to process message with AI:', error);
            await sendSlackMessage(
              event.event!.channel!, 
              'Sorry, I encountered an error processing your message. Please try again later.'
            );
          }
        });
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