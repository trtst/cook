import assert from "node:assert/strict";
import test from "node:test";
import { BadRequestException, HttpException, HttpStatus, ServiceUnavailableException, UnauthorizedException } from "@nestjs/common";
import { ApiExceptionFilter } from "./api-exception.filter";

function createHost() {
  let statusCode = 0;
  let body: unknown;

  const response = {
    status(code: number) {
      statusCode = code;
      return {
        json(value: unknown) {
          body = value;
        }
      };
    }
  };

  return {
    host: {
      switchToHttp() {
        return {
          getResponse: () => response,
          getRequest: () => ({
            path: "/api/auth/sms/send",
            context: { requestId: "test-request" }
          })
        };
      }
    },
    read() {
      return {
        statusCode,
        body: body as { code: number; message: string; data: unknown; serverTime: string }
      };
    }
  };
}

function capture(exception: unknown) {
  const filter = new ApiExceptionFilter();
  (filter as unknown as { logger: { error: () => void } }).logger = { error: () => undefined };
  const target = createHost();
  filter.catch(exception, target.host as never);
  return target.read();
}

test("business HttpException returns HTTP 200 and preserves business code", () => {
  const badRequest = capture(new BadRequestException("手机号格式不正确"));
  assert.equal(badRequest.statusCode, HttpStatus.OK);
  assert.equal(badRequest.body.code, 400);
  assert.equal(badRequest.body.message, "手机号格式不正确");
  assert.equal(badRequest.body.data, null);

  const unauthorized = capture(new UnauthorizedException("未登录或 token 失效"));
  assert.equal(unauthorized.statusCode, HttpStatus.OK);
  assert.equal(unauthorized.body.code, 401);
  assert.equal(unauthorized.body.message, "未登录或 token 失效");

  const unavailable = capture(new ServiceUnavailableException("短信服务暂不可用"));
  assert.equal(unavailable.statusCode, HttpStatus.OK);
  assert.equal(unavailable.body.code, 503);
  assert.equal(unavailable.body.message, "短信服务暂不可用");
});

test("business HttpException preserves custom code and data in the response body", () => {
  const result = capture(
    new BadRequestException({
      code: 429,
      message: "请求过于频繁",
      data: { retryAfterSeconds: 30 }
    })
  );

  assert.equal(result.statusCode, HttpStatus.OK);
  assert.equal(result.body.code, 429);
  assert.deepEqual(result.body.data, { retryAfterSeconds: 30 });
});

test("framework route misses keep their HTTP status", () => {
  const result = capture(
    new HttpException(
      {
        statusCode: 404,
        message: "Cannot GET /api/users/login",
        error: "Not Found"
      },
      HttpStatus.NOT_FOUND
    )
  );

  assert.equal(result.statusCode, HttpStatus.NOT_FOUND);
  assert.equal(result.body.code, 404);
});

test("unexpected errors remain real HTTP 500 failures", () => {
  const result = capture(new Error("database connection failed"));

  assert.equal(result.statusCode, HttpStatus.INTERNAL_SERVER_ERROR);
  assert.equal(result.body.code, 500);
  assert.equal(result.body.message, "服务异常");
});
