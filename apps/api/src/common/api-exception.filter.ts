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

function normalizeMessage(message: string | string[] | undefined, fallback: string) {
  if (Array.isArray(message)) return message.join("; ");
  return message || fallback;
}

function extractPayload(exception: unknown): { status: number; code: number; message: string; data: unknown | null } {
  if (!(exception instanceof HttpException)) {
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 500,
      message: "服务异常",
      data: null
    };
  }

  const status = exception.getStatus();
  const response = exception.getResponse();
  const payload = typeof response === "object" && response !== null ? (response as ExceptionPayload) : {};
  const message = typeof response === "string" ? response : normalizeMessage(payload.message, exception.message);

  return {
    status,
    code: payload.code ?? status,
    message,
    data: payload.data ?? null
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

    if (payload.status >= 500) {
      const message = exception instanceof Error ? exception.message : String(exception);
      const stack = exception instanceof Error ? exception.stack : undefined;
      this.logger.error(`${request.context?.requestId ?? "unknown"} ${request.path ?? ""} ${message}`, stack);
    }

    response.status(payload.status).json({
      code: payload.code,
      message: payload.message,
      data: payload.data,
      serverTime: new Date().toISOString()
    });
  }
}
