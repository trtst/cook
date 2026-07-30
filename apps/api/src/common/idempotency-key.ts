import { applyDecorators, BadRequestException, createParamDecorator, ExecutionContext, Injectable, type PipeTransform } from "@nestjs/common";
import { ApiHeader } from "@nestjs/swagger";

export const IDEMPOTENCY_KEY_HEADER = "Idempotency-Key";
const IDEMPOTENCY_KEY_PATTERN = /^\d+$/;

@Injectable()
export class IdempotencyKeyPipe implements PipeTransform<string | undefined, string> {
  transform(value: string | undefined) {
    const normalized = value?.trim() ?? "";

    if (!normalized) {
      throw new BadRequestException(`缺少 ${IDEMPOTENCY_KEY_HEADER} 请求头`);
    }

    if (!IDEMPOTENCY_KEY_PATTERN.test(normalized)) {
      throw new BadRequestException(`${IDEMPOTENCY_KEY_HEADER} 必须是纯数字字符串`);
    }

    return normalized;
  }
}

export function parseIdempotencyKey(value: string | undefined) {
  return new IdempotencyKeyPipe().transform(value);
}

export const ReadIdempotencyKey = createParamDecorator((_data: unknown, context: ExecutionContext) => {
  const request = context.switchToHttp().getRequest<{ headers?: Record<string, string | string[] | undefined> }>();
  const rawValue = request.headers?.[IDEMPOTENCY_KEY_HEADER.toLowerCase()];
  const normalized = Array.isArray(rawValue) ? rawValue[0] : rawValue;

  return parseIdempotencyKey(normalized);
});

export function ApiIdempotencyKey() {
  return applyDecorators(
    ApiHeader({
      name: IDEMPOTENCY_KEY_HEADER,
      required: true,
      description: "可重试写操作的幂等键，必须是纯数字字符串。",
      schema: {
        type: "string",
        pattern: "^[0-9]+$"
      }
    })
  );
}
