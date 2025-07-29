import crypto from 'crypto';

/**
 * Telegram bot token HMAC verification
 * Verifies webhook authenticity using bot token HMAC
 */
export function verifyTelegramBotTokenSignature(body: string, receivedHash?: string): boolean {
    if (!process.env.TELEGRAM_BOT_TOKEN) {
        console.error('TELEGRAM_BOT_TOKEN not configured');
        return false;
    }

    // If no hash provided, reject the request for security
    if (!receivedHash) {
        console.error('No Telegram signature provided - webhook rejected for security');
        return false;
    }

    try {
        // Generate HMAC using bot token
        const expectedHash = crypto
            .createHmac('sha256', process.env.TELEGRAM_BOT_TOKEN)
            .update(body)
            .digest('hex');

        // Constant-time comparison to prevent timing attacks
        return crypto.timingSafeEqual(
            Buffer.from(receivedHash, 'hex'),
            Buffer.from(expectedHash, 'hex')
        );
    } catch (error) {
        console.error('Error verifying Telegram bot token signature:', error);
        return false;
    }
}

/**
 * Basic Telegram data validation
 * Validates that the incoming data has the required Telegram structure
 */
export function validateTelegramUpdate(body: string): boolean {
    try {
        const update = JSON.parse(body);
        return typeof update.update_id === 'number';
    } catch (error) {
        console.error('Invalid JSON in Telegram webhook:', error);
        return false;
    }
}

/**
 * Slack signature verification
 * Verifies webhook authenticity using Slack's signature verification method
 */
export function verifySlackSignature(body: string, timestamp: string, signature: string): boolean {
    if (!process.env.SLACK_SIGNING_SECRET) {
        console.error('SLACK_SIGNING_SECRET not configured');
        return false;
    }

    const time = parseInt(timestamp);
    const currentTime = Math.floor(Date.now() / 1000);

    // Check if timestamp is too old (5 minutes)
    if (Math.abs(currentTime - time) > 300) {
        console.error('Slack request timestamp too old');
        return false;
    }

    const sigBasestring = `v0:${timestamp}:${body}`;
    const hash = crypto
        .createHmac('sha256', process.env.SLACK_SIGNING_SECRET)
        .update(sigBasestring)
        .digest('hex');

    const expectedSignature = `v0=${hash}`;

    return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
    );
} 