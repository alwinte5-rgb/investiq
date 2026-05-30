/**
 * Consistent API response + error contract.
 * Success: { data }   Error: { error, code? }
 * Never leak stack traces or internal messages to clients.
 */
export const ERROR_CODES = [
  "UNAUTHORIZED",
  "FORBIDDEN",
  "VALIDATION",
  "NOT_FOUND",
  "RATE_LIMITED",
  "UPSTREAM_UNAVAILABLE",
  "QUOTA_EXCEEDED",
  "INSUFFICIENT_DATA",
  "INTERNAL",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export interface ApiError {
  error: string;
  code?: ErrorCode;
}

export type ApiResponse<T> = { data: T } | ApiError;

export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly httpStatus: number,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const errors = {
  unauthorized: (m = "Authentication required") => new AppError("UNAUTHORIZED", m, 401),
  forbidden: (m = "You do not have access to this resource") => new AppError("FORBIDDEN", m, 403),
  validation: (m = "Invalid request") => new AppError("VALIDATION", m, 400),
  notFound: (m = "Not found") => new AppError("NOT_FOUND", m, 404),
  rateLimited: (m = "Too many requests") => new AppError("RATE_LIMITED", m, 429),
  upstream: (m = "Upstream service unavailable") => new AppError("UPSTREAM_UNAVAILABLE", m, 502),
  quota: (m = "Plan quota exceeded") => new AppError("QUOTA_EXCEEDED", m, 402),
  insufficientData: (m: string) => new AppError("INSUFFICIENT_DATA", m, 422),
  internal: (m = "Something went wrong") => new AppError("INTERNAL", m, 500),
};

/** Map any thrown value to a safe client error body + status. */
export function toApiError(err: unknown): { body: ApiError; status: number } {
  if (err instanceof AppError) {
    return { body: { error: err.message, code: err.code }, status: err.httpStatus };
  }
  // Unknown internal error: never expose details.
  return { body: { error: "Something went wrong", code: "INTERNAL" }, status: 500 };
}
