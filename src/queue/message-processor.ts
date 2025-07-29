import { Job } from 'bull';
import { MessageJob, messageQueue } from './queue-manager';
import { AIService } from '../services/ai-service';
import { ConversationService } from '../services/conversation-service';

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

// Platform response dispatcher
async function sendPlatformResponse(platform: string, channelId: string, message: string) {
  switch (platform) {
    case 'telegram':
      await sendTelegramMessage(parseInt(channelId), message);
      break;
    case 'slack':
      await sendSlackMessage(channelId, message);
      break;
    default:
      throw new Error(`Unknown platform: ${platform}`);
  }
}

// Process function that handles the actual work
export const processMessage = async (job: Job<MessageJob>) => {
  const { platform, messageData, conversationId, userId } = job.data;
  
  try {
    // Update job progress
    await job.progress(10);
    console.log(`🔄 Processing job ${job.id} for ${platform} platform`);
    
    // Persist user message to database
    const { conversation } = await ConversationService.addUserMessage(
      platform,
      messageData.channelId,
      userId,
      messageData.text,
      messageData.messageId,
      messageData.metadata || {}
    );
    
    await job.progress(30);
    
    // Get conversation history for context
    const conversationHistory = await ConversationService.getConversationHistory(
      conversation.id,
      4000 // max tokens for context
    );
    
    await job.progress(50);
    
    // Format messages for AI
    const formattedMessages = ConversationService.formatMessagesForAI(conversationHistory);
    
    // Process with AI
    const aiResponse = await aiService.processMessage(messageData.text, formattedMessages);
    
    await job.progress(70);
    
    // Persist AI response to database
    await ConversationService.addAssistantMessage(
      conversation.id,
      aiResponse.content,
      {
        ...(aiResponse.usage?.totalTokens && { token_count: aiResponse.usage.totalTokens }),
      }
    );
    
    await job.progress(90);
    
    // Send response to platform
    await sendPlatformResponse(platform, messageData.channelId, aiResponse.content);
    
    await job.progress(100);
    console.log(`✅ Job ${job.id} completed successfully`);
    
    return { success: true, response: aiResponse.content };
    
  } catch (error) {
    console.error(`❌ Job ${job.id} failed:`, error);
    
    // Send error message to user
    try {
      await sendPlatformResponse(
        platform, 
        messageData.channelId, 
        'Sorry, I encountered an error processing your message. Please try again later.'
      );
    } catch (sendError) {
      console.error('Failed to send error message to user:', sendError);
    }
    
    throw error; // This will trigger retry logic
  }
};

// Register the processor with concurrency limit
messageQueue.process('process-message', 5, processMessage);

// Job event handlers for monitoring
messageQueue.on('completed', (job, result) => {
  console.log(`✅ Job ${job.id} completed:`, result.success ? 'Success' : 'Failed');
});

messageQueue.on('failed', (job, error) => {
  console.error(`❌ Job ${job.id} failed after ${job.attemptsMade} attempts:`, error.message);
});

messageQueue.on('stalled', (job) => {
  console.warn(`⚠️ Job ${job.id} stalled`);
});

messageQueue.on('active', (job) => {
  console.log(`🔄 Job ${job.id} started processing`);
});

export default messageQueue;
