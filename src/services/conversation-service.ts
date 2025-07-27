import { ConversationModel, type Conversation, type ConversationInsert } from '../database/models/conversation';
import { MessageModel, type Message, type MessageInsert } from '../database/models/message';

export class ConversationService {
  static async getOrCreateConversation(
    platform: string,
    channel_id: string,
    user_id: string,
    title?: string
  ): Promise<Conversation> {
    let conversation = await ConversationModel.findByPlatformAndChannel(
      platform,
      channel_id,
      user_id
    );

    if (!conversation) {
      const conversationData: ConversationInsert = {
        platform,
        channel_id,
        user_id,
        ...(title && { title }),
      };
      conversation = await ConversationModel.create(conversationData);
    }

    return conversation;
  }

  static async addMessage(
    conversation_id: string,
    role: 'user' | 'assistant' | 'system',
    content: string,
    options: {
      platform_message_id?: string;
      platform_data?: any;
      token_count?: number;
      ai_provider?: string;
      ai_model?: string;
      ai_cost?: number;
    } = {}
  ): Promise<Message> {
    const messageData: MessageInsert = {
      conversation_id,
      role,
      content,
      ...options,
    };

    const message = await MessageModel.create(messageData);
    
    await ConversationModel.incrementMessageCount(conversation_id);

    return message;
  }

  static async addUserMessage(
    platform: string,
    channel_id: string,
    user_id: string,
    content: string,
    platform_message_id?: string,
    platform_data?: any
  ): Promise<{ conversation: Conversation; message: Message }> {
    const conversation = await this.getOrCreateConversation(
      platform,
      channel_id,
      user_id
    );

    const message = await this.addMessage(
      conversation.id,
      'user',
      content,
      {
        ...(platform_message_id && { platform_message_id }),
        ...(platform_data && { platform_data }),
      }
    );

    return { conversation, message };
  }

  static async addAssistantMessage(
    conversation_id: string,
    content: string,
    options: {
      token_count?: number;
      ai_provider?: string;
      ai_model?: string;
      ai_cost?: number;
      platform_message_id?: string;
      platform_data?: any;
    } = {}
  ): Promise<Message> {
    return this.addMessage(conversation_id, 'assistant', content, options);
  }

  static async getConversationHistory(
    conversation_id: string,
    maxTokens?: number
  ): Promise<Message[]> {
    return MessageModel.findConversationHistory(conversation_id, maxTokens);
  }

  static async getConversationMessages(
    conversation_id: string,
    limit: number = 100,
    offset: number = 0
  ): Promise<Message[]> {
    return MessageModel.findByConversation(conversation_id, limit, offset);
  }

  static async findConversationByPlatformMessage(
    platform_message_id: string
  ): Promise<{ conversation: Conversation | null; message: Message | null }> {
    const message = await MessageModel.findByPlatformMessageId(platform_message_id);
    
    if (!message) {
      return { conversation: null, message: null };
    }

    const conversation = await ConversationModel.findById(message.conversation_id);
    
    return { conversation, message };
  }

  static async getUserConversations(
    user_id: string,
    platform?: string,
    limit: number = 50
  ): Promise<Conversation[]> {
    return ConversationModel.findUserConversations(user_id, platform, limit);
  }

  static async updateConversationTitle(
    conversation_id: string,
    title: string
  ): Promise<Conversation | null> {
    return ConversationModel.update(conversation_id, { title });
  }

  static async deactivateConversation(conversation_id: string): Promise<void> {
    await ConversationModel.deactivate(conversation_id);
  }

  static async cleanupOldMessages(
    conversation_id: string,
    keepCount: number = 100
  ): Promise<number> {
    return MessageModel.deleteOldMessages(conversation_id, keepCount);
  }

  static async getConversationStats(conversation_id: string): Promise<{
    messageCount: number;
    totalTokens: number;
    conversation: Conversation | null;
  }> {
    const [messageCount, totalTokens, conversation] = await Promise.all([
      MessageModel.countByConversation(conversation_id),
      MessageModel.getTotalTokensByConversation(conversation_id),
      ConversationModel.findById(conversation_id),
    ]);

    return {
      messageCount,
      totalTokens,
      conversation,
    };
  }

  static formatMessagesForAI(messages: Message[]): Array<{ role: 'user' | 'assistant' | 'system'; content: string }> {
    return messages.map(message => ({
      role: message.role,
      content: message.content,
    }));
  }

  static async findOrCreateConversationByPlatformData(
    platform: string,
    channel_id: string,
    user_id: string,
    platform_message_id?: string
  ): Promise<Conversation> {
    if (platform_message_id) {
      const { conversation } = await this.findConversationByPlatformMessage(platform_message_id);
      if (conversation) {
        return conversation;
      }
    }

    return this.getOrCreateConversation(platform, channel_id, user_id);
  }
}