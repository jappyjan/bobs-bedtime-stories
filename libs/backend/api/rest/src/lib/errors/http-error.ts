export class HttpError extends Error {
  public readonly httpStatusCode: number;

  constructor(msg: string, httpStatusCode: number) {
    super(msg);
    this.httpStatusCode = httpStatusCode;
  }
}

export class UnauthorizedError extends HttpError {
  constructor(reason?: string) {
    super(reason ?? 'Unauthorized', 401);
  }
}

export class AccessDeniedError extends HttpError {
  constructor(reason: string) {
    super(`Access denied: ${reason}`, 403);
  }
}

export class NotFoundError extends HttpError {
  constructor(reason: string) {
    super(`Not found: ${reason}`, 404);
  }
}
