import { NextFunction, Request, Response } from 'express';

interface RawBodyOptions {
    limit?: number;
    timeout?: number;
    encoding?: BufferEncoding;
}

/**
 * Secure raw body capture middleware for webhook signature verification
 * Includes size limits, timeouts, and proper error handling
 */
export function createRawBodyCapture(options: RawBodyOptions = {}) {
    const {
        limit = 1024 * 1024, // 1MB default limit
        timeout = 10000, // 10 second timeout
        encoding = 'utf8'
    } = options;

    return (req: Request, res: Response, next: NextFunction) => {
        // Skip if body already parsed or not a webhook route
        if (req.body !== undefined || !req.url?.startsWith('/webhook')) {
            return next();
        }

        // Validate content type for webhooks
        const contentType = req.headers['content-type'];
        if (!contentType?.includes('application/json')) {
            return res.status(400).json({
                error: 'Content-Type must be application/json for webhooks'
            });
        }

        let size = 0;
        let data = '';
        let timeoutId: NodeJS.Timeout;

        // Set up timeout
        const cleanup = () => {
            if (timeoutId) clearTimeout(timeoutId);
        };

        timeoutId = setTimeout(() => {
            cleanup();
            req.destroy();
            res.status(408).json({ error: 'Request timeout' });
        }, timeout);

        // Handle stream errors
        req.on('error', (error) => {
            cleanup();
            console.error('Stream error during raw body capture:', error);
            if (!res.headersSent) {
                res.status(400).json({ error: 'Stream error' });
            }
        });

        req.on('aborted', () => {
            cleanup();
            console.warn('Request aborted during raw body capture');
        });

        req.setEncoding(encoding);

        req.on('data', (chunk: string) => {
            size += Buffer.byteLength(chunk, encoding);

            // Check size limit
            if (size > limit) {
                cleanup();
                req.destroy();
                res.status(413).json({
                    error: 'Payload too large',
                    limit: `${limit} bytes`
                });
                return; // Just return void, don't return the response
            }

            data += chunk;
        });

        req.on('end', () => {
            cleanup();

            try {
                // Store raw body for signature verification
                (req as any).rawBody = data;

                // Parse JSON
                if (data.trim()) {
                    req.body = JSON.parse(data);
                } else {
                    req.body = {};
                }

                next();
            } catch (error) {
                console.error('Failed to parse webhook JSON:', error);
                res.status(400).json({
                    error: 'Invalid JSON',
                    details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
                });
            }
        });
    };
} 