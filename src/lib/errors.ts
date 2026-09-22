export class AppError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status = 400) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = status;
  }
}

export class AuthError extends AppError {
  constructor(message: string, status = 401) {
    super("AUTH", message, status);
    this.name = "AuthError";
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "You cannot access that record.") {
    super("FORBIDDEN", message, 403);
    this.name = "ForbiddenError";
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Not found.") {
    super("NOT_FOUND", message, 404);
    this.name = "NotFoundError";
  }
}

export function publicErrorMessage(error: unknown): string {
  if (error instanceof AppError) {
    return error.message;
  }
  return "Something went wrong. Please try again.";
}
