import assert from "node:assert/strict";
import test from "node:test";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { AuthController } from "./auth.controller";
import {
  CompletePhoneChangeDto,
  AuthPasswordLoginDto,
  AuthPhoneCodeSendDto,
  AuthPhoneChangeNewCodeDto,
  AuthSmsLoginDto,
  AuthSmsSendDto,
  AuthWechatPhoneLoginDto,
  AuthWechatSessionDto,
  CreateAdminUserDto,
  StartPhoneChangeDto,
  LogoutAuthSessionDto,
  RefreshAuthSessionDto,
  ResetAdminUserPasswordDto,
  AuthSetPasswordDto,
  AuthChangePasswordDto,
  ChangeCurrentPasswordDto,
  UpdateCurrentUserDto
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

test("phone change code requests keep their own scene and require the current phone proof before completion", async () => {
  await assertValid(AuthPhoneCodeSendDto, { phone: "13800000000", deviceId: "device-a" });
  await assertInvalid(AuthPhoneCodeSendDto, { phone: "13800000000" });
  await assertInvalid(AuthPhoneCodeSendDto, { phone: "13800000000", deviceId: "device-a", scene: "LOGIN" });
  await assertValid(StartPhoneChangeDto, { phone: "13800000000", code: "123456" });
  await assertInvalid(StartPhoneChangeDto, { phone: "13800000000", code: "12345" });
  await assertValid(AuthPhoneChangeNewCodeDto, { changeToken: "phone-change-token", phone: "13900000000", deviceId: "device-a" });
  await assertInvalid(AuthPhoneChangeNewCodeDto, { phone: "13900000000", deviceId: "device-a" });
  await assertValid(CompletePhoneChangeDto, { changeToken: "phone-change-token", phone: "13900000000", code: "654321" });
  await assertInvalid(CompletePhoneChangeDto, { phone: "13900000000", code: "654321" });
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

test("password write DTOs use the shared 8 to 20 character limit", async () => {
  await assertValid(AuthSetPasswordDto, { password: "abc12345" });
  await assertInvalid(AuthSetPasswordDto, { password: "abc1234" });
  await assertInvalid(AuthSetPasswordDto, { password: "abc123456789012345678" });

  await assertValid(AuthChangePasswordDto, { currentPassword: "old-pass", newPassword: "abc12345" });
  await assertInvalid(AuthChangePasswordDto, { currentPassword: "old-pass", newPassword: "abc1234" });
  await assertInvalid(AuthChangePasswordDto, { currentPassword: "old-pass", newPassword: "abc123456789012345678" });

  await assertValid(ChangeCurrentPasswordDto, { currentPassword: "old-pass", newPassword: "abc12345" });
  await assertInvalid(ChangeCurrentPasswordDto, { currentPassword: "old-pass", newPassword: "abc1234" });
  await assertInvalid(ChangeCurrentPasswordDto, { currentPassword: "old-pass", newPassword: "abc123456789012345678" });

  await assertValid(CreateAdminUserDto, { phone: "13800000000", password: "abc12345" });
  await assertInvalid(CreateAdminUserDto, { phone: "13800000000", password: "abc1234" });
  await assertInvalid(CreateAdminUserDto, { phone: "13800000000", password: "abc123456789012345678" });

  await assertValid(ResetAdminUserPasswordDto, { newPassword: "abc12345" });
  await assertInvalid(ResetAdminUserPasswordDto, { newPassword: "abc1234" });
  await assertInvalid(ResetAdminUserPasswordDto, { newPassword: "abc123456789012345678" });
});

test("current user profile accepts only confirmed editable profile fields", async () => {
  const validBirthDate = "1990-09-04";

  await assertValid(UpdateCurrentUserDto, {
    nickname: "晚餐记录员",
    cookNo: "cook520",
    bio: "喜欢记录家里的晚饭",
    gender: "FEMALE",
    birthDate: validBirthDate
  });

  await assertInvalid(UpdateCurrentUserDto, { avatarUrl: "https://example.com/avatar.png" });
  await assertInvalid(UpdateCurrentUserDto, { nickname: null });
  await assertInvalid(UpdateCurrentUserDto, { nickname: "x" });
  await assertInvalid(UpdateCurrentUserDto, { nickname: "炊火记用户" });
  await assertInvalid(UpdateCurrentUserDto, { cookNo: null });
  await assertInvalid(UpdateCurrentUserDto, { cookNo: "1234" });
  await assertInvalid(UpdateCurrentUserDto, { cookNo: "abcde" });
  await assertInvalid(UpdateCurrentUserDto, { cookNo: "cook520_abcdefghijklmn" });
  await assertInvalid(UpdateCurrentUserDto, { cookNo: "cook no" });
  await assertInvalid(UpdateCurrentUserDto, { gender: "SECRET" });
  await assertInvalid(UpdateCurrentUserDto, { birthDate: "1990/09/04" });
});
