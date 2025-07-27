// Extend Express Request interface to include rawBody
declare global {
    namespace Express {
        interface Request {
            rawBody?: string;
        }
    }
}

export { };
