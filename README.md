# LLM Chatbot

A production-ready, self-hosted AI chatbot with conversation history and webhook-based platform integrations.

## Features

- **Multi-Platform Support**: Telegram and Slack webhook integrations
- **AI Provider Flexibility**: OpenAI and self-hosted models with automatic fallback
- **Conversation Persistence**: PostgreSQL database with complete message history
- **Secure Webhooks**: Cryptographic signature verification for all platforms
- **Containerized Deployment**: Docker Compose setup with PostgreSQL and Redis
- **Health Monitoring**: Comprehensive health checks for all services
- **TypeScript**: Full type safety throughout the application

## Architecture

- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js for HTTP handling
- **Database**: PostgreSQL with Knex.js for migrations and queries
- **Caching**: Redis (ready for future queue implementation)
- **Containerization**: Docker with docker-compose
- **AI Providers**: OpenAI GPT models and self-hosted model support

### Message Processing Flow

```mermaid
graph TD
    A[Platform sends webhook<br/>Telegram/Slack] --> B{Verify webhook<br/>signature}
    B -->|❌ Invalid| C[Return 401 Unauthorized]
    B -->|✅ Valid| D[Parse & validate<br/>message data]
    
    D --> E{Is text message?}
    E -->|No| F[Acknowledge webhook<br/>Return 200 OK]
    E -->|Yes| G[Acknowledge webhook<br/>Return 200 OK]
    
    G --> H[Process async]
    H --> I[Find existing conversation<br/>by platform + channel + user]
    I --> J{Conversation exists?}
    J -->|No| K[Create new conversation<br/>in database]
    J -->|Yes| L[Use existing conversation]
    K --> M[Store user message<br/>in messages table]
    L --> M
    
    M --> N[Get conversation history<br/>limit by token count]
    N --> O[Format messages for AI<br/>system + history + user]
    O --> P[Send to AI service]
    
    P --> Q{Primary AI<br/>provider works?}
    Q -->|Yes| R[Get AI response]
    Q -->|No| S{Fallback provider<br/>configured?}
    S -->|No| T[Error: All providers failed]
    S -->|Yes| U[Try fallback provider]
    U --> V{Fallback works?}
    V -->|No| T
    V -->|Yes| R
    
    R --> W[Store AI response<br/>in messages table]
    W --> X[Send response to platform<br/>via API call]
    
    T --> Y[Send error message<br/>to user]
    
    style A fill:#e1f5fe
    style B fill:#fff3e0
    style P fill:#f3e5f5
    style W fill:#e8f5e8
    style X fill:#e8f5e8
```

## Quick Start

### Prerequisites

- Docker and Docker Compose
- Node.js 18+ (for local development)

### Setup

1. **Clone and install dependencies**:
   ```bash
   git clone <repository-url>
   cd llm-chatbot
   npm install
   ```

2. **Start infrastructure services**:
   ```bash
   docker-compose up -d postgres redis
   ```

3. **Configure environment variables**:
   ```bash
   cp .env.example .env  # Create this file with the variables below
   ```

4. **Set required environment variables** in `.env`:
   ```bash
   # Database Configuration
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=llm_chatbot_dev
   DB_USER=postgres
   DB_PASSWORD=password

   # AI Service Configuration (choose one primary + optional fallback)
   # Option 1: OpenAI
   OPENAI_API_KEY=sk-your-openai-api-key
   OPENAI_MODEL=gpt-4o-mini  # optional, defaults to gpt-4o-mini

   # Option 2: Self-hosted model
   SELFHOSTED_API_KEY=your-selfhosted-api-key
   SELFHOSTED_BASE_URL=https://your-model-endpoint.com
   SELFHOSTED_MODEL=your-model-name  # optional

   # Fallback AI Provider (optional)
   FALLBACK_OPENAI_API_KEY=sk-your-fallback-openai-key
   # OR
   FALLBACK_SELFHOSTED_API_KEY=your-fallback-key
   FALLBACK_SELFHOSTED_BASE_URL=https://your-fallback-endpoint.com

   # Platform Bot Tokens
   TELEGRAM_BOT_TOKEN=your_telegram_bot_token
   SLACK_BOT_TOKEN=xoxb-your-slack-bot-token
   SLACK_SIGNING_SECRET=your_slack_signing_secret

   # Telegram Webhook Security (optional but recommended)
   TELEGRAM_WEBHOOK_SECRET=your_generated_secret_token
   ```

5. **Run database migrations**:
   ```bash
   npm run db:migrate
   ```

6. **Start development server**:
   ```bash
   npm run dev
   ```

7. **Verify health**:
   ```bash
   curl http://localhost:3000/health
   ```

### Full Docker Deployment

For production deployment with all services:

```bash
# Start all services including the app
docker-compose --profile app up -d

# Run migrations inside container
docker-compose exec chatbot npm run db:migrate
```

## Platform Setup

### Telegram Bot

1. **Create bot with BotFather**:
   - Message [@BotFather](https://t.me/botfather) on Telegram
   - Create a new bot and copy the token to `TELEGRAM_BOT_TOKEN`

2. **Set webhook URL**:
   ```bash
   curl -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
     -H "Content-Type: application/json" \
     -d '{"url": "https://your-domain.com/webhook/telegram"}'
   ```

3. **Optional: Add webhook security** (recommended):
   ```bash
   # Generate secret token
   TELEGRAM_WEBHOOK_SECRET=$(openssl rand -hex 32)
   echo "TELEGRAM_WEBHOOK_SECRET=$TELEGRAM_WEBHOOK_SECRET" >> .env
   
   # Set webhook with secret
   curl -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
     -H "Content-Type: application/json" \
     -d "{
       \"url\": \"https://your-domain.com/webhook/telegram\",
       \"secret_token\": \"$TELEGRAM_WEBHOOK_SECRET\"
     }"
   ```

### Slack Bot

1. **Create Slack app**:
   - Go to [Slack API Apps](https://api.slack.com/apps)
   - Create new app and get the bot token (`SLACK_BOT_TOKEN`)
   - Get the signing secret from Basic Information (`SLACK_SIGNING_SECRET`)

2. **Configure event subscriptions**:
   - Enable Events and set webhook URL: `https://your-domain.com/webhook/slack`
   - Subscribe to `message.channels`, `message.groups`, `message.im` events

3. **Set OAuth permissions**:
   - Add `chat:write`, `channels:history`, `groups:history`, `im:history` scopes

## API Endpoints

### Health Checks
- `GET /health` - Basic health check
- `GET /webhook/health` - Webhook services health with configuration status

### Webhooks
- `POST /webhook/telegram` - Telegram bot webhook
- `POST /webhook/slack` - Slack event webhook

### Root
- `GET /` - API information and available endpoints

## Database Schema

### Conversations Table
- `id` (UUID) - Primary key
- `platform` (string) - Platform identifier (telegram, slack)
- `channel_id` (string) - Platform-specific channel/chat ID
- `user_id` (string) - Platform-specific user ID
- `title` (string, optional) - Conversation title
- `created_at`, `updated_at`, `last_message_at` - Timestamps
- `message_count` (integer) - Total messages in conversation
- `is_active` (boolean) - Whether conversation is active

### Messages Table
- `id` (UUID) - Primary key
- `conversation_id` (UUID) - Foreign key to conversations
- `role` (enum) - user, assistant, or system
- `content` (text) - Message content
- `platform_message_id` (string, optional) - Platform-specific message ID
- `platform_data` (JSON, optional) - Platform-specific metadata
- `token_count` (integer, optional) - AI token usage
- `ai_provider`, `ai_model` (string, optional) - AI service metadata
- `created_at`, `updated_at` - Timestamps

## Development

### Available Scripts

```bash
npm run dev          # Start development server with hot reload
npm run build        # Build TypeScript to JavaScript
npm start           # Start production server
npm run typecheck   # TypeScript type checking

# Database management
npm run db:migrate            # Run pending migrations
npm run db:migrate:make NAME  # Create new migration
npm run db:migrate:rollback   # Rollback last migration
npm run db:seed              # Run database seeds

# Utilities
npm run ngrok       # Start ngrok tunnel for webhook testing
```

### Project Structure

```
src/
├── database/
│   ├── connection.ts       # Database connection setup
│   └── models/            # Data models
│       ├── conversation.ts
│       └── message.ts
├── middleware/
│   └── raw-body-capture.ts # Webhook signature verification
├── routes/
│   └── webhooks.ts        # Webhook route handlers
├── schemas/
│   └── webhooks.ts        # Zod validation schemas
├── services/
│   ├── ai-service.ts      # AI provider management
│   ├── conversation-service.ts # Business logic
│   ├── openai-client.ts   # OpenAI API client
│   └── selfhosted-client.ts # Self-hosted model client
├── types/
│   └── express.ts         # Express type extensions
├── utils/
│   └── webhook-verification.ts # Security utilities
└── server.ts              # Express server setup
```

## Security Features

- **Webhook Verification**: All platform webhooks use cryptographic signature verification
- **Raw Body Capture**: Secure middleware for webhook signature validation
- **HTTPS Ready**: Built for secure production deployment
- **Input Validation**: Zod schemas validate all incoming webhook data
- **Rate Limiting Ready**: Middleware structure supports easy rate limiting addition

## Monitoring and Debugging

### Logs
Application logs include detailed webhook processing information:
- Incoming webhook validation
- AI processing steps
- Database operations
- Error handling with stack traces

### Health Checks
The `/webhook/health` endpoint provides comprehensive status:
- Platform configuration status
- AI provider connectivity
- Database connectivity
- Service health indicators

### Database Tools
Access Adminer for database management:
- URL: `http://localhost:8080`
- Server: `postgres`
- Database: `llm_chatbot_dev`
- Username: `postgres`
- Password: `password`

## Deployment

### Environment Variables

All configuration is done via environment variables. See the setup section above for required variables.

### Docker Deployment

The included `docker-compose.yml` provides:
- PostgreSQL database with persistent storage
- Redis cache (ready for queue implementation)
- Adminer database administration interface
- Application container (when using `--profile app`)

### Scaling Considerations

- **Stateless Design**: Each request is independent, supporting horizontal scaling
- **Database Connection Pooling**: Configured via Knex.js
- **Webhook Timeouts**: Fast acknowledgment prevents platform timeouts
- **Async Processing**: Message processing happens after webhook acknowledgment

## Contributing

1. Follow TypeScript best practices
2. Add proper error handling for all external API calls
3. Include appropriate logging for debugging
4. Validate all inputs with Zod schemas
5. Write database migrations for schema changes

## License

ISC


