import { OpenAIClient, ChatMessage, AIResponse, AIProvider } from './openai-client';
import { SelfHostedClient } from './selfhosted-client';

export class AIService {
  private primaryProvider: AIProvider;
  private fallbackProvider?: AIProvider | undefined;

  constructor(config: {
    primaryProvider: AIProvider;
    fallbackProvider?: AIProvider | undefined;
  }) {
    this.primaryProvider = config.primaryProvider;
    this.fallbackProvider = config.fallbackProvider;
  }

  async processMessage(userMessage: string, conversationHistory: ChatMessage[] = []): Promise<AIResponse> {
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: 'You are a helpful AI assistant. Respond concisely and helpfully to user messages.'
      },
      ...conversationHistory,
      {
        role: 'user',
        content: userMessage
      }
    ];

    try {
      return await this.primaryProvider.chat(messages);
    } catch (error) {
      console.error('Primary AI provider failed:', error);
      
      if (this.fallbackProvider) {
        console.log('Attempting fallback provider...');
        try {
          return await this.fallbackProvider.chat(messages);
        } catch (fallbackError) {
          console.error('Fallback AI provider also failed:', fallbackError);
          throw new Error('All AI providers failed');
        }
      }
      
      throw error;
    }
  }

  async isHealthy(): Promise<{
    primary: boolean;
    fallback?: boolean | undefined;
    overall: boolean;
  }> {
    const primaryHealthy = await this.primaryProvider.isHealthy();
    const fallbackHealthy = this.fallbackProvider ? await this.fallbackProvider.isHealthy() : undefined;
    
    return {
      primary: primaryHealthy,
      fallback: fallbackHealthy,
      overall: primaryHealthy || (fallbackHealthy ?? false)
    };
  }

  static createFromConfig(): AIService {
    // Determine primary provider type
    let primaryProvider: AIProvider;
    
    if (process.env.OPENAI_API_KEY) {
      // Use official OpenAI client
      primaryProvider = new OpenAIClient({
        apiKey: process.env.OPENAI_API_KEY,
        ...(process.env.OPENAI_MODEL && { model: process.env.OPENAI_MODEL })
      });
    } else if (process.env.SELFHOSTED_API_KEY && process.env.SELFHOSTED_BASE_URL) {
      // Use self-hosted client
      primaryProvider = new SelfHostedClient({
        apiKey: process.env.SELFHOSTED_API_KEY,
        baseURL: process.env.SELFHOSTED_BASE_URL,
        ...(process.env.SELFHOSTED_MODEL && { model: process.env.SELFHOSTED_MODEL })
      });
    } else {
      throw new Error('No AI provider configured. Set either OPENAI_API_KEY or both SELFHOSTED_API_KEY and SELFHOSTED_BASE_URL');
    }

    // Determine fallback provider
    let fallbackProvider: AIProvider | undefined = undefined;
    
    if (process.env.FALLBACK_OPENAI_API_KEY) {
      // Fallback to OpenAI
      fallbackProvider = new OpenAIClient({
        apiKey: process.env.FALLBACK_OPENAI_API_KEY,
        ...(process.env.FALLBACK_OPENAI_MODEL && { model: process.env.FALLBACK_OPENAI_MODEL })
      });
    } else if (process.env.FALLBACK_SELFHOSTED_API_KEY && process.env.FALLBACK_SELFHOSTED_BASE_URL) {
      // Fallback to self-hosted
      fallbackProvider = new SelfHostedClient({
        apiKey: process.env.FALLBACK_SELFHOSTED_API_KEY,
        baseURL: process.env.FALLBACK_SELFHOSTED_BASE_URL,
        ...(process.env.FALLBACK_SELFHOSTED_MODEL && { model: process.env.FALLBACK_SELFHOSTED_MODEL })
      });
    }

    return new AIService({
      primaryProvider,
      fallbackProvider
    });
  }
}