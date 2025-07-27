import db from '../connection';

export interface Conversation {
  id: string;
  platform: string;
  channel_id: string;
  user_id: string;
  title?: string;
  created_at: Date;
  updated_at: Date;
  last_message_at: Date;
  message_count: number;
  is_active: boolean;
}

export interface ConversationInsert {
  platform: string;
  channel_id: string;
  user_id: string;
  title?: string;
}

export interface ConversationUpdate {
  title?: string;
  last_message_at?: Date;
  message_count?: number;
  is_active?: boolean;
}

export class ConversationModel {
  static async create(data: ConversationInsert): Promise<Conversation> {
    const [conversation] = await db('conversations')
      .insert({
        ...data,
        message_count: 0,
        is_active: true,
      })
      .returning('*');
    return conversation;
  }

  static async findById(id: string): Promise<Conversation | null> {
    const conversation = await db('conversations')
      .where({ id })
      .first();
    return conversation || null;
  }

  static async findByPlatformAndChannel(
    platform: string,
    channel_id: string,
    user_id?: string
  ): Promise<Conversation | null> {
    let query = db('conversations')
      .where({ platform, channel_id });
    
    if (user_id) {
      query = query.where({ user_id });
    }
    
    const conversation = await query
      .where({ is_active: true })
      .orderBy('last_message_at', 'desc')
      .first();
    
    return conversation || null;
  }

  static async update(id: string, data: ConversationUpdate): Promise<Conversation | null> {
    const [conversation] = await db('conversations')
      .where({ id })
      .update({
        ...data,
        updated_at: new Date(),
      })
      .returning('*');
    return conversation || null;
  }

  static async incrementMessageCount(id: string): Promise<void> {
    await db('conversations')
      .where({ id })
      .increment('message_count', 1)
      .update({
        last_message_at: new Date(),
        updated_at: new Date(),
      });
  }

  static async findUserConversations(
    user_id: string,
    platform?: string,
    limit: number = 50
  ): Promise<Conversation[]> {
    let query = db('conversations')
      .where({ user_id, is_active: true });
    
    if (platform) {
      query = query.where({ platform });
    }
    
    return query
      .orderBy('last_message_at', 'desc')
      .limit(limit);
  }

  static async deactivate(id: string): Promise<void> {
    await db('conversations')
      .where({ id })
      .update({
        is_active: false,
        updated_at: new Date(),
      });
  }
}