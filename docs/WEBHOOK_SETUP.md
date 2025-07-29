# Webhook Security Setup Guide

## Telegram Webhook Security

### Option 1: Secret Token (Recommended for Production)

1. **Generate a random secret token:**
```bash
TELEGRAM_WEBHOOK_SECRET=$(openssl rand -hex 32)
echo "TELEGRAM_WEBHOOK_SECRET=$TELEGRAM_WEBHOOK_SECRET" >> .env
```

2. **Set webhook with secret token:**
```bash
curl -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
  -H "Content-Type: application/json" \
  -d "{
    \"url\": \"https://ourdomain.com/webhook/telegram\",
    \"secret_token\": \"$TELEGRAM_WEBHOOK_SECRET\"
  }"
```

### Option 2: Bot Token HMAC (Current Setup Compatible)

Our current setup with only `TELEGRAM_BOT_TOKEN` will work but with limited security:

- ✅ **HTTPS encryption** protects data in transit
- ✅ **JSON structure validation** prevents malformed requests  
- ⚠️ **No cryptographic verification** - anyone can send fake webhooks

**To add HMAC verification to our current setup:**

```bash
# Telegram doesn't automatically send HMAC signatures
# We'd need to implement custom signature generation on their side
# OR upgrade to secret token method (recommended)
```

## Slack Webhook Security

### Required: HMAC-SHA256 Signature Verification

1. **Get our signing secret from Slack app settings:**
   - Go to https://api.slack.com/apps
   - Select our app → Basic Information → Signing Secret

2. **Add to environment:**
```bash
echo "SLACK_SIGNING_SECRET=our_slack_signing_secret_here" >> .env
```

3. **Set webhook URL in Slack app:**
   - Event Subscriptions → Request URL: `https://ourdomain.com/webhook/slack`

## Security Levels

### Maximum Security (Production)
```bash
# .env file
TELEGRAM_BOT_TOKEN=our_bot_token
TELEGRAM_WEBHOOK_SECRET=generated_random_secret  # 64+ char random string
SLACK_SIGNING_SECRET=our_slack_signing_secret
```

### Our Current Setup (Functional but Less Secure)
```bash
# .env file  
TELEGRAM_BOT_TOKEN=our_bot_token
# No TELEGRAM_WEBHOOK_SECRET = allows unsigned webhooks
# No SLACK_SIGNING_SECRET = rejects all Slack webhooks
```

## Testing Our Security Setup

### Test Telegram:
```bash
# Should succeed (with warning if no secret token)
curl -X POST http://localhost:3000/webhook/telegram \
  -H "Content-Type: application/json" \
  -d '{"update_id": 123, "message": {"message_id": 1, "from": {"id": 12345, "is_bot": false, "first_name": "Test"}, "chat": {"id": 67890, "type": "private"}, "date": 1234567890, "text": "Hello bot"}}'
```

### Test Slack:
```bash
# Should fail without proper signature
curl -X POST http://localhost:3000/webhook/slack \
  -H "Content-Type: application/json" \
  -d '{"type":"url_verification","challenge":"test"}'
```

## Upgrade Path

**For production, implement secret token verification:**

1. Generate secret: `openssl rand -hex 32`
2. Add to `.env`: `TELEGRAM_WEBHOOK_SECRET=generated_secret`
3. Update webhook: Use Telegram API to set webhook with secret
4. Restart server

This provides cryptographic verification that webhooks actually come from Telegram.