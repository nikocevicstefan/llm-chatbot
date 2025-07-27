import { z } from 'zod';

// Telegram webhook schema
export const TelegramUpdateSchema = z.object({
    update_id: z.number(),
    message: z.object({
        message_id: z.number(),
        from: z.object({
            id: z.number(),
            is_bot: z.boolean(),
            first_name: z.string(),
            username: z.string().optional(),
            language_code: z.string().optional(),
        }),
        chat: z.object({
            id: z.number(),
            first_name: z.string().optional(),
            username: z.string().optional(),
            type: z.enum(['private', 'group', 'supergroup', 'channel']),
        }),
        date: z.number(),
        text: z.string().optional(),
    }).optional(),
});

// Slack event schema
export const SlackEventSchema = z.object({
    token: z.string(),
    team_id: z.string().optional(),
    api_app_id: z.string().optional(),
    event: z.object({
        type: z.string(),
        channel: z.string().optional(),
        user: z.string().optional(),
        text: z.string().optional(),
        ts: z.string().optional(),
    }).optional(),
    type: z.string(),
    challenge: z.string().optional(),
});

// Type exports for convenience
export type TelegramUpdate = z.infer<typeof TelegramUpdateSchema>;
export type SlackEvent = z.infer<typeof SlackEventSchema>; 