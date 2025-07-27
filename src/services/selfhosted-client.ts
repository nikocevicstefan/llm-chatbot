import OpenAI from 'openai';
import { ChatMessage, AIResponse, AIProvider } from './openai-client';

export class SelfHostedClient implements AIProvider {
  private client: OpenAI;
  private model: string;
  private baseURL: string;

  constructor(config: {
    apiKey: string;
    baseURL: string;
    model?: string;
  }) {
    this.baseURL = config.baseURL;
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
    });
    this.model = config.model || 'llama-3-8b-instruct';
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
      console.error('Self-hosted API error:', error);
      throw new Error(`Self-hosted API failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async isHealthy(): Promise<boolean> {
    try {
      // Try a simple models list call to check connectivity
      await this.client.models.list();
      return true;
    } catch (error) {
      console.warn(`Self-hosted client health check failed for ${this.baseURL}:`, error);
      return false;
    }
  }

  getProviderInfo() {
    return {
      type: 'self-hosted',
      baseURL: this.baseURL,
      model: this.model
    };
  }
}