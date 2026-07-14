export class DbConfigError extends Error {
  readonly code = 'DB_NOT_CONFIGURED';
  readonly status = 503;

  constructor(message: string) {
    super(message);
    this.name = 'DbConfigError';
  }
}

export class DbConnectionError extends Error {
  readonly code = 'DB_CONNECTION_FAILED';
  readonly status = 500;

  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'DbConnectionError';
  }
}

export function isDbError(e: unknown): e is DbConfigError | DbConnectionError {
  return e instanceof DbConfigError || e instanceof DbConnectionError;
}
