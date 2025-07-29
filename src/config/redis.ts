import Redis from 'ioredis';

const redisConfig = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD || '',
    retryDelayOnFailover: 100,
    maxRetriesPerRequest: 3,
};

export const redis = new Redis(redisConfig);
export const redisSubscriber = new Redis(redisConfig);

// Test connection
redis.on('connect', () => console.log('Redis connected'));
redis.on('error', (err) => console.error('Redis error:', err));