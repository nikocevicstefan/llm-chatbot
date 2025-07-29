import Queue from 'bull';

export interface MessageJob {
    platform: 'discord' | 'telegram' | 'slack';
    messageData: any;
    conversationId: string;
    userId: string;
    timestamp: Date;
}

export const messageQueue = new Queue<MessageJob>('message-processing', {
    redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD || '',
        // Enable TLS for production environments
        ...(process.env.NODE_ENV === 'production' && process.env.REDIS_TLS === 'true' && {
            tls: {
                rejectUnauthorized: process.env.REDIS_TLS_REJECT_UNAUTHORIZED !== 'false'
            }
        }),
    },
    defaultJobOptions: {
        removeOnComplete: 100, // Keep last 100 completed jobs
        removeOnFail: 20, // Keep last 20 failed jobs
        attempts: 3, // Retry 3 times
        backoff: {
            type: 'exponential', // Exponential backoff
            delay: 1000, // 1 second delay
        },
    },
});

process.on('SIGTERM', async () => {
    await messageQueue.close();
    process.exit(0);
});
