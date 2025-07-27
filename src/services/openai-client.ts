import OpenAI from 'openai';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  } | undefined;
}

export interface AIProvider {
  chat(messages: ChatMessage[]): Promise<AIResponse>;
  isHealthy(): Promise<boolean>;
}

export class OpenAIClient implements AIProvider {
  private client: OpenAI;
  private model: string;

  constructor(config: {
    apiKey: string;
    model?: string;
  }) {
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: 'https://api.openai.com/v1',
    });
    this.model = config.model || 'gpt-3.5-turbo';
  }

  async chat(messages: ChatMessage[]): Promise<AIResponse> {
    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: messages,
        temperature: 0.7,
        max_tokens: 1000,
      });

      const choice = response.choices[0];
      if (!choice?.message?.content) {
        throw new Error('No content in AI response');
      }

      return {
        content: choice.message.content,
        usage: response.usage ? {
          promptTokens: response.usage.prompt_tokens,
          completionTokens: response.usage.completion_tokens,
          totalTokens: response.usage.total_tokens,
        } : undefined,
      };
    } catch (error) {
      console.error('OpenAI API error:', error);
      throw new Error(`OpenAI API failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async isHealthy(): Promise<boolean> {
    try {
      await this.client.models.list();
      return true;
    } catch {
      return false;
    }
  }

  getProviderInfo() {
    return {
      type: 'openai',
      baseURL: 'https://api.openai.com/v1',
      model: this.model
    };
  }
}