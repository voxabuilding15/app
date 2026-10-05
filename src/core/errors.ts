export class AppError extends Error {
  readonly code: string;

  constructor(code: string, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'AppError';
    this.code = code;
  }
}

export function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong';
}
