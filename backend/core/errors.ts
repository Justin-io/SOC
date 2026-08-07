/**
 * AEGIS-X Backend — Application Error Hierarchy
 */

export class AegisError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, code: string, statusCode: number, isOperational = true) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AegisError {
  public readonly field?: string;
  constructor(message: string, field?: string) {
    super(message, 'VALIDATION_ERROR', 400);
    this.field = field;
  }
}

export class NotFoundError extends AegisError {
  constructor(resource: string, id: string) {
    super(`${resource} not found: ${id}`, 'NOT_FOUND', 404);
  }
}

export class AuthError extends AegisError {
  constructor(message = 'Unauthorized') {
    super(message, 'AUTH_ERROR', 401);
  }
}

export class ForbiddenError extends AegisError {
  constructor(message = 'Forbidden') {
    super(message, 'FORBIDDEN', 403);
  }
}

export class IntelligenceError extends AegisError {
  public readonly agentRole?: string;
  constructor(message: string, agentRole?: string) {
    super(message, 'INTELLIGENCE_ERROR', 500, false);
    this.agentRole = agentRole;
  }
}

export class AgentError extends AegisError {
  public readonly agentRole: string;
  public readonly recoverable: boolean;
  constructor(message: string, agentRole: string, recoverable = true) {
    super(message, 'AGENT_ERROR', 500, recoverable);
    this.agentRole = agentRole;
    this.recoverable = recoverable;
  }
}

export class ExternalApiError extends AegisError {
  public readonly provider: string;
  constructor(message: string, provider: string) {
    super(message, 'EXTERNAL_API_ERROR', 502, true);
    this.provider = provider;
  }
}

export class CircuitOpenError extends AegisError {
  public readonly provider: string;
  constructor(provider: string) {
    super(`Circuit breaker open for ${provider}`, 'CIRCUIT_OPEN', 503, true);
    this.provider = provider;
  }
}

export class TimeoutError extends AegisError {
  constructor(operation: string, timeoutMs: number) {
    super(`Operation timed out after ${timeoutMs}ms: ${operation}`, 'TIMEOUT', 408, true);
  }
}

export function isOperationalError(error: unknown): boolean {
  if (error instanceof AegisError) return error.isOperational;
  return false;
}

export function toHttpError(error: unknown): { statusCode: number; code: string; message: string } {
  if (error instanceof AegisError) {
    return {
      statusCode: error.statusCode,
      code: error.code,
      message: error.message,
    };
  }
  return {
    statusCode: 500,
    code: 'INTERNAL_ERROR',
    message: 'An unexpected error occurred',
  };
}
