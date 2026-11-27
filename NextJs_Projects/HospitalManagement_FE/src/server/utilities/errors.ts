/** Domain error thrown by services; mapped to a standardised API response by `server/http/api.ts` and to ActionState by server actions. */
export class AppError extends Error {
    constructor(
        public status: number,
        public code: string,
        message: string,
        public fields?: Record<string, string>,
    ) {
        super(message);
        this.name = "AppError";
    }
}
export const badRequest = (m: string, fields?: Record<string, string>) => new AppError(400, "BAD_REQUEST", m, fields);
export const unauthorized = (m = "Authentication required") => new AppError(401, "UNAUTHORIZED", m);
export const forbidden = (m = "You do not have permission to do that") => new AppError(403, "FORBIDDEN", m);
export const notFound = (what = "Resource") => new AppError(404, "NOT_FOUND", `${what} not found`);
export const conflict = (m: string, fields?: Record<string, string>) => new AppError(409, "CONFLICT", m, fields);
export const tooMany = (m = "Too many attempts, try again later") => new AppError(429, "TOO_MANY_REQUESTS", m);
