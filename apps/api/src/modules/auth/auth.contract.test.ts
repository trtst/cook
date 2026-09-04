import assert from "node:assert/strict";
import test from "node:test";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { AuthController } from "./auth.controller";
import {
  AuthPasswordLoginDto,
  AuthSmsLoginDto,
  AuthSmsSendDto,
  AuthWechatPhoneLoginDto,
  AuthWechatSessionDto,
  LogoutAuthSessionDto,
  RefreshAuthSessionDto
} from "../../contracts/dtos";

async function assertValid<T extends object>(type: new () => T, input: Record<string, unknown>) {
  const errors = await validate(plainToInstance(type, input), { whitelist: true, forbidNonWhitelisted: true });
  assert.equal(errors.length, 0, JSON.stringify(errors));
}

async function assertInvalid<T extends object>(type: new () => T, input: Record<string, unknown>) {
  const errors = await validate(plainToInstance(type, input), { whitelist: true, forbidNonWhitelisted: true });
  assert.ok(errors.length > 0);
}

test("wechat session requires code and deviceId", async () => {
  await assertValid(AuthWechatSessionDto, { code: "wx-code", deviceId: "device-a" });
  await assertInvalid(AuthWechatSessionDto, { code: "wx-code" });
  await assertInvalid(AuthWechatSessionDto, { code: "wx-code", deviceId: "" });
});

test("wechat phone login requires one-time session and phone code", async () => {
  await assertValid(AuthWechatPhoneLoginDto, {
    wechatSessionId: "session-id",
    phoneCode: "phone-code",
    deviceId: "device-a"
  });
  await assertInvalid(AuthWechatPhoneLoginDto, { wechatSessionId: "session-id", phoneCode: "" });
});

test("sms and password login require deviceId and reject legacy fields", async () => {
  await assertValid(AuthSmsSendDto, { phone: "13800000000", scene: "LOGIN", deviceId: "device-a" });
  await assertValid(AuthSmsLoginDto, { phone: "13800000000", code: "123456", deviceId: "device-a" });
  await assertValid(AuthPasswordLoginDto, { phone: "13800000000", password: "change-me", deviceId: "device-a" });
  await assertInvalid(AuthSmsSendDto, { phone: "13800000000", scene: "LOGIN", deviceId: "device-a", code: "123456" });
  await assertInvalid(AuthPasswordLoginDto, { phone: "13800000000", password: "change-me" });
});

test("refresh requires the opaque refresh token and deviceId", async () => {
  await assertValid(RefreshAuthSessionDto, { refreshToken: "refresh-token", deviceId: "device-a" });
  await assertInvalid(RefreshAuthSessionDto, { refreshToken: "refresh-token" });
});

test("logout returns a null data envelope", async () => {
  const controller = new AuthController({
    logout: async (_body: LogoutAuthSessionDto) => undefined
  } as never);

  const response = await controller.logout({ refreshToken: "refresh-token", deviceId: "device-a" });

  assert.equal(response.code, 0);
  assert.equal(response.message, "ok");
  assert.equal(response.data, null);
  assert.ok(response.serverTime);
});
