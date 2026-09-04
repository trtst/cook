import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from "@nestjs/common";
import type { RequestWithContext } from "./auth-context";

interface HttpResponse {
  status(statusCode: number): {
    json(body: unknown): void;
  };
}

interface HttpRequest extends Partial<RequestWithContext> {
  path?: string;
}

interface ExceptionPayload {
  code?: number;
  message?: string | string[];
  data?: unknown;
}

interface NormalizedException {
  httpStatus: number;
  code: number;
  message: string;
  data: unknown | null;
  shouldLog: boolean;
}

function normalizeMessage(message: string | string[] | undefined, fallback: string) {
  if (Array.isArray(message)) return message.join("; ");
  return message || fallback;
}

function isRouteMiss(status: number, message: string) {
  return status === HttpStatus.NOT_FOUND && /^Cannot (GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD) /.test(message);
}

function extractPayload(exception: unknown): NormalizedException {
  if (!(exception instanceof HttpException)) {
    return {
      httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 500,
      message: "服务异常",
      data: null,
      shouldLog: true
    };
  }

  const status = exception.getStatus();
  const response = exception.getResponse();
  const payload = typeof response === "object" && response !== null ? (response as ExceptionPayload) : {};
  const message = typeof response === "string" ? response : normalizeMessage(payload.message, exception.message);

  return {
    httpStatus: isRouteMiss(status, message) ? status : HttpStatus.OK,
    code: payload.code ?? status,
    message,
    data: payload.data ?? null,
    shouldLog: false
  };
}

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const http = host.switchToHttp();
    const response = http.getResponse<HttpResponse>();
    const request = http.getRequest<HttpRequest>();
    const payload = extractPayload(exception);

    if (payload.shouldLog) {
      const message = exception instanceof Error ? exception.message : String(exception);
      const stack = exception instanceof Error ? exception.stack : undefined;
      this.logger.error(`${request.context?.requestId ?? "unknown"} ${request.path ?? ""} ${message}`, stack);
    }

    response.status(payload.httpStatus).json({
      code: payload.code,
      message: payload.message,
      data: payload.data,
      serverTime: new Date().toISOString()
    });
  }
}
