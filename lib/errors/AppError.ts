// /lib/errors/AppError.ts

export type ErrorCode =
  // Auth
  | "UNAUTHORIZED" | "FORBIDDEN" | "SESSION_EXPIRED"
  // Validation
  | "VALIDATION_ERROR" | "MISSING_FIELD" | "INVALID_COORDINATES"
  // Database
  | "DB_QUERY_FAILED" | "DB_NOT_FOUND" | "DB_CONFLICT" | "DB_UNAVAILABLE"
  // AI / Routing
  | "DISPATCH_FAILED" | "NO_AMBULANCE_AVAILABLE" | "ROUTE_CALC_FAILED" | "MAP_API_UNAVAILABLE"
  // Rate limiting
  | "RATE_LIMITED"
  // External services
  | "SUPABASE_UNAVAILABLE" | "OSRM_UNAVAILABLE"
  // Generic
  | "INTERNAL_ERROR" | "UNKNOWN";

export interface ErrorContext {
  requestId?:    string;
  assignmentId?: string;
  userId?:       string;
  endpoint?:     string;
  [key: string]: unknown;
}

// ─── Base ─────────────────────────────────────────────────────────────────────

export class AppError extends Error {
  readonly code:       ErrorCode;
  readonly statusCode: number;
  readonly context:    ErrorContext;
  readonly isOperational: boolean; // false = programmer error, should alert

  constructor(
    message: string,
    code: ErrorCode = "INTERNAL_ERROR",
    statusCode = 500,
    context: ErrorContext = {},
    isOperational = true,
  ) {
    super(message);
    this.name        = "AppError";
    this.code        = code;
    this.statusCode  = statusCode;
    this.context     = context;
    this.isOperational = isOperational;
    Error.captureStackTrace?.(this, this.constructor);
  }

  toJSON() {
    return { error: this.message, code: this.code, context: this.context };
  }
}

// ─── Subclasses ───────────────────────────────────────────────────────────────

export class ValidationError extends AppError {
  constructor(message: string, context?: ErrorContext) {
    super(message, "VALIDATION_ERROR", 400, context);
    this.name = "ValidationError";
  }
}

export class AuthError extends AppError {
  constructor(message = "Unauthorized", context?: ErrorContext) {
    super(message, "UNAUTHORIZED", 401, context);
    this.name = "AuthError";
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Forbidden", context?: ErrorContext) {
    super(message, "FORBIDDEN", 403, context);
    this.name = "ForbiddenError";
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, context?: ErrorContext) {
    super(`${resource} not found`, "DB_NOT_FOUND", 404, context);
    this.name = "NotFoundError";
  }
}

export class ConflictError extends AppError {
  constructor(message: string, context?: ErrorContext) {
    super(message, "DB_CONFLICT", 409, context);
    this.name = "ConflictError";
  }
}

export class RateLimitError extends AppError {
  constructor(context?: ErrorContext) {
    super("Too many requests. Please wait before trying again.", "RATE_LIMITED", 429, context);
    this.name = "RateLimitError";
  }
}

export class DatabaseError extends AppError {
  constructor(message: string, context?: ErrorContext) {
    super(message, "DB_QUERY_FAILED", 503, context, true);
    this.name = "DatabaseError";
  }
}

export class DispatchError extends AppError {
  constructor(message: string, context?: ErrorContext) {
    super(message, "DISPATCH_FAILED", 503, context);
    this.name = "DispatchError";
  }
}

export class RouteError extends AppError {
  constructor(message: string, context?: ErrorContext) {
    super(message, "ROUTE_CALC_FAILED", 503, context);
    this.name = "RouteError";
  }
}

export class MapApiError extends AppError {
  constructor(context?: ErrorContext) {
    super("Map routing service unavailable. Using fallback directions.", "MAP_API_UNAVAILABLE", 503, context);
    this.name = "MapApiError";
  }
}

// ─── Type guard ───────────────────────────────────────────────────────────────

export function isAppError(err: unknown): err is AppError {
  return err instanceof AppError;
}

export function toAppError(err: unknown): AppError {
  if (isAppError(err)) return err;
  if (err instanceof Error) return new AppError(err.message, "UNKNOWN", 500, {}, false);
  return new AppError("An unexpected error occurred", "UNKNOWN", 500, {}, false);
}
