import db from '../connection';

export interface Message {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  platform_message_id?: string;
  platform_data?: any;
  token_count?: number;
  ai_provider?: string;
  ai_model?: string;
  ai_cost?: number;
  created_at: Date;
  updated_at: Date;
}

export interface MessageInsert {
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  platform_message_id?: string;
  platform_data?: any;
  token_count?: number;
  ai_provider?: string;
  ai_model?: string;
  ai_cost?: number;
}

export interface MessageUpdate {
  content?: string;
  platform_data?: any;
  token_count?: number;
  ai_provider?: string;
  ai_model?: string;
  ai_cost?: number;
}

export class MessageModel {
  static async create(data: MessageInsert): Promise<Message> {
    const [message] = await db('messages')
      .insert(data)
      .returning('*');
    return message;
  }

  static async findById(id: string): Promise<Message | null> {
    const message = await db('messages')
      .where({ id })
      .first();
    return message || null;
  }

  static async findByConversation(
    conversation_id: string,
    limit: number = 100,
    offset: number = 0
  ): Promise<Message[]> {
    return db('messages')
      .where({ conversation_id })
      .orderBy('created_at', 'asc')
      .limit(limit)
      .offset(offset);
  }

  static async findConversationHistory(
    conversation_id: string,
    maxTokens?: number
  ): Promise<Message[]> {
    const messages = await db('messages')
      .where({ conversation_id })
      .orderBy('created_at', 'desc');

    if (!maxTokens) {
      return messages.reverse();
    }

    let totalTokens = 0;
    const filteredMessages: Message[] = [];

    for (const message of messages) {
      const messageTokens = message.token_count || this.estimateTokenCount(message.content);
      
      if (totalTokens + messageTokens > maxTokens && filteredMessages.length > 0) {
        break;
      }
      
      totalTokens += messageTokens;
      filteredMessages.unshift(message);
    }

    return filteredMessages;
  }

  static async update(id: string, data: MessageUpdate): Promise<Message | null> {
    const [message] = await db('messages')
      .where({ id })
      .update({
        ...data,
        updated_at: new Date(),
      })
      .returning('*');
    return message || null;
  }

  static async countByConversation(conversation_id: string): Promise<number> {
    const result = await db('messages')
      .where({ conversation_id })
      .count('* as count')
      .first();
    return parseInt(result?.count as string) || 0;
  }

  static async getTotalTokensByConversation(conversation_id: string): Promise<number> {
    const result = await db('messages')
      .where({ conversation_id })
      .sum('token_count as total')
      .first();
    return parseInt(result?.total as string) || 0;
  }

  static async deleteOldMessages(
    conversation_id: string,
    keepCount: number
  ): Promise<number> {
    const messagesToKeep = await db('messages')
      .where({ conversation_id })
      .orderBy('created_at', 'desc')
      .limit(keepCount)
      .select('id');

    const keepIds = messagesToKeep.map(m => m.id);

    if (keepIds.length === 0) {
      return 0;
    }

    const deletedCount = await db('messages')
      .where({ conversation_id })
      .whereNotIn('id', keepIds)
      .del();

    return deletedCount;
  }

  static async findByPlatformMessageId(
    platform_message_id: string
  ): Promise<Message | null> {
    const message = await db('messages')
      .where({ platform_message_id })
      .first();
    return message || null;
  }

  private static estimateTokenCount(text: string): number {
    return Math.ceil(text.length / 4);
  }
}