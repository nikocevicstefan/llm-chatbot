# AI Chatbot - Self-Hosted Edition

A production-ready, self-hosted multi-platform AI chatbot with conversation history and message queuing.

## Architecture

This self-hosted solution uses:

- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js for HTTP handling  
- **Database**: PostgreSQL for persistent storage
- **Message Queue**: Redis with Bull Queue for async processing
- **Caching**: Redis for conversation caching
- **Containerization**: Docker with docker-compose
- **Process Management**: PM2 for production deployment

## Features

- **Multi-Platform Support**: Discord, Telegram, and Slack integrations
- **AI Provider Flexibility**: OpenAI GPT-4 and Anthropic Claude with automatic fallbacks
- **Conversation Memory**: Hybrid Redis (fast access) + PostgreSQL (persistence) storage
- **Message Queue**: Async processing with retry logic and error handling
- **Health Monitoring**: Comprehensive health checks for all components
- **Production Ready**: Docker containerization, PM2 clustering, Nginx reverse proxy
- **Security**: Webhook signature verification, rate limiting, HTTPS support

## Quick Start

1. **Clone and setup**:
   ```bash
   cd ai-chatbot-selfhosted
   cp .env.example .env
   ```

2. **Configure environment variables** in `.env`:
   ```bash
   # Platform Bot Tokens
   DISCORD_TOKEN=your_discord_bot_token
   TELEGRAM_BOT_TOKEN=your_telegram_bot_token
   SLACK_BOT_TOKEN=xoxb-your-slack-bot-token
   
   # AI Service API Keys
   OPENAI_API_KEY=sk-your-openai-api-key
   ANTHROPIC_API_KEY=sk-ant-your-anthropic-api-key
   
   # Database & Redis passwords
   DATABASE_PASSWORD=your_secure_password
   REDIS_PASSWORD=your_redis_password
   ```

3. **Start with Docker Compose**:
   ```bash
   docker-compose up -d
   ```

4. **Run database migrations**:
   ```bash
   docker-compose exec chatbot npm run db:migrate
   docker-compose exec chatbot npm run db:seed
   ```

5. **Check health**:
   ```bash
   curl http://localhost:3000/health/detailed
   ```

## Development Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Start local services** (PostgreSQL and Redis):
   ```bash
   docker-compose up -d postgres redis
   ```

3. **Run migrations**:
   ```bash
   npm run db:migrate
   npm run db:seed
   ```

4. **Start development server**:
   ```bash
   npm run dev
   ```

## Platform Setup

### Discord Bot
1. Create an application at https://discord.com/developers/applications
2. Create a bot and copy the token to `DISCORD_TOKEN`
3. Set webhook URL to `https://your-domain.com/webhook/discord`
4. Enable necessary intents and permissions

### Telegram Bot
1. Message @BotFather on Telegram to create a new bot
2. Copy the bot token to `TELEGRAM_BOT_TOKEN`
3. Set webhook URL: `https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://your-domain.com/webhook/telegram`

### Slack Bot
1. Create an app at https://api.slack.com/apps
2. Copy the bot token to `SLACK_BOT_TOKEN`
3. Set webhook URL to `https://your-domain.com/webhook/slack`
4. Subscribe to relevant bot events

## Production Deployment

### With Docker Compose (Recommended)
```bash
# Production deployment with Nginx
docker-compose --profile nginx up -d

# Without Nginx (if you have external load balancer)
docker-compose up -d
```

### Manual Deployment
```bash
# Build the application
npm run build

# Start with PM2
npm start

# Monitor
npm run logs
```

## API Endpoints

### Health Checks
- `GET /health` - Basic health check
- `GET /health/detailed` - Comprehensive health check with all dependencies
- `GET /health/db` - Database health and stats
- `GET /health/redis` - Redis health and stats
- `GET /health/queue` - Message queue stats
- `GET /health/ai` - AI services connectivity
- `GET /health/platforms` - Platform API connectivity

### Webhooks
- `POST /webhook/discord` - Discord interactions
- `POST /webhook/telegram` - Telegram updates
- `POST /webhook/slack` - Slack events
- `POST /webhook/slack/interactive` - Slack interactive components

## Configuration

### Environment Variables
See `.env.example` for all available configuration options.

### Database Configuration
The application uses Knex.js for database operations. Configuration is in `knexfile.js`.

### PM2 Configuration
Process management configuration is in `ecosystem.config.js`.

### Nginx Configuration
Reverse proxy configuration is in `nginx.conf`.

## Monitoring and Logging

### Logs
- Application logs: `./logs/combined.log`
- Error logs: `./logs/error.log`
- PM2 logs: `npm run logs`

### Health Monitoring
- Built-in health checks at `/health/*` endpoints
- Docker health checks configured
- PM2 process monitoring

### Metrics
- Database: Connection stats, query performance
- Redis: Memory usage, key counts
- Queue: Job statistics, processing times
- AI Services: Token usage, response times

## Security

- **Webhook Verification**: All platform webhooks are cryptographically verified
- **Rate Limiting**: Configurable rate limits per endpoint
- **HTTPS**: Nginx SSL termination support
- **Container Security**: Non-root user, minimal attack surface
- **Secrets Management**: Environment variable based configuration

## Scaling

### Horizontal Scaling
- Multiple chatbot instances behind load balancer
- Shared PostgreSQL and Redis instances
- Session-less design for perfect horizontal scaling

### Vertical Scaling
- PM2 cluster mode for multi-core utilization
- Configurable memory limits and auto-restart
- Database connection pooling


