export class ApiClientError<T = unknown> extends Error {
  constructor(
    readonly code: number,
    message: string,
    readonly data: T | null = null
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

export class UnauthorizedError<T = unknown> extends ApiClientError<T> {
  constructor(message = "未登录或 token 失效", data: T | null = null) {
    super(401, message, data);
    this.name = "UnauthorizedError";
  }
}

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message);
    this.name = "HttpError";
  }
}
