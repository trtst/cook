import assert from "node:assert/strict";
import test from "node:test";
import { AliyunSmsGateway, SmsAuthService, type SmsHttpClient } from "./sms-auth.service";

function createFakePrisma() {
  const records: Array<Record<string, any>> = [];
  return {
    records,
    smsCode: {
      create: async ({ data }: { data: Record<string, any> }) => {
        const record = { id: records.length + 1, ...data };
        records.push(record);
        return record;
      },
      findFirst: async ({ where }: { where: Record<string, any> }) =>
        [...records]
          .reverse()
          .find(record => record.phone === where.phone && record.scene === where.scene) ?? null,
      updateMany: async ({ where, data }: { where: Record<string, any>; data: Record<string, any> }) => {
        const record = records.find(item => item.id === where.id && item.consumedAt === null);
        if (!record) return { count: 0 };
        Object.assign(record, data);
        return { count: 1 };
      }
    },
    authRiskEvent: { create: async () => undefined }
  };
}

test("stores the provider SMS challenge and consumes it once", async () => {
  const prisma = createFakePrisma();
  const provider = {
    send: async () => ({ providerOutId: "sms-login-1" }),
    verify: async (_phone: string, code: string, providerOutId: string | null) =>
      code === "123456" && providerOutId === "sms-login-1"
  };
  const risk = { assertAllowed: async () => undefined };
  const service = new SmsAuthService(prisma as never, risk as never, provider as never);

  const result = await service.sendLoginCode("13800000000", { ip: "127.0.0.1", deviceId: "device-a" });
  assert.equal(result.cooldownSeconds, 60);
  assert.equal(prisma.records[0].codeHash, null);
  assert.equal(prisma.records[0].code, undefined);
  assert.equal(prisma.records[0].providerOutId, "sms-login-1");

  await service.consumeLoginCode("13800000000", "123456");
  await assert.rejects(() => service.consumeLoginCode("13800000000", "123456"), { message: "验证码已使用" });
});

test("rejects an SMS code when the provider check does not pass", async () => {
  const prisma = createFakePrisma();
  const provider = {
    send: async () => ({ providerOutId: "sms-login-2" }),
    verify: async () => false
  };
  const risk = { assertAllowed: async () => undefined };
  const service = new SmsAuthService(prisma as never, risk as never, provider as never);

  await service.sendLoginCode("13800000000", { ip: "127.0.0.1", deviceId: "device-a" });

  await assert.rejects(() => service.consumeLoginCode("13800000000", "654321"), { message: "验证码错误" });
  assert.equal(prisma.records[0].consumedAt, null);
});

test("adds the signed PNVS send query to a configured Aliyun endpoint", async () => {
  const previous = {
    accessKeyId: process.env.SMS_ACCESS_KEY_ID,
    accessKeySecret: process.env.SMS_ACCESS_KEY_SECRET,
    signName: process.env.SMS_SIGN_NAME,
    templateCode: process.env.SMS_TEMPLATE_CODE,
    endpoint: process.env.SMS_ENDPOINT
  };
  const requests: string[] = [];

  process.env.SMS_ACCESS_KEY_ID = "access-key";
  process.env.SMS_ACCESS_KEY_SECRET = "access-secret";
  process.env.SMS_SIGN_NAME = "炊火记";
  process.env.SMS_TEMPLATE_CODE = "SMS_123";
  process.env.SMS_ENDPOINT = "https://sms.example.test/";

  try {
    const http: SmsHttpClient = async input => {
      requests.push(String(input));
      return new Response(JSON.stringify({ Code: "OK" }), { status: 200 });
    };
    const gateway = new AliyunSmsGateway(http);

    const result = await gateway.send("13800000000");

    assert.equal(requests.length, 1);
    const url = new URL(requests[0]);
    assert.equal(url.searchParams.get("Action"), "SendSmsVerifyCode");
    assert.equal(url.searchParams.get("PhoneNumber"), "13800000000");
    assert.equal(url.searchParams.get("TemplateCode"), "SMS_123");
    assert.ok(url.searchParams.get("Signature"));
    assert.equal(url.searchParams.get("TemplateParam"), JSON.stringify({ code: "##code##", min: "5" }));
    assert.equal(url.searchParams.get("CodeType"), "1");
    assert.equal(url.searchParams.get("CodeLength"), "6");
    assert.equal(url.searchParams.get("ValidTime"), "300");
    assert.equal(url.searchParams.get("Interval"), "60");
    assert.equal(url.searchParams.get("ReturnVerifyCode"), "false");
    assert.equal(result.providerOutId, url.searchParams.get("OutId"));
  } finally {
    for (const [key, value] of Object.entries({
      SMS_ACCESS_KEY_ID: previous.accessKeyId,
      SMS_ACCESS_KEY_SECRET: previous.accessKeySecret,
      SMS_SIGN_NAME: previous.signName,
      SMS_TEMPLATE_CODE: previous.templateCode,
      SMS_ENDPOINT: previous.endpoint
    })) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("checks the provider SMS verification result through PNVS", async () => {
  const previous = {
    accessKeyId: process.env.SMS_ACCESS_KEY_ID,
    accessKeySecret: process.env.SMS_ACCESS_KEY_SECRET,
    signName: process.env.SMS_SIGN_NAME,
    templateCode: process.env.SMS_TEMPLATE_CODE,
    endpoint: process.env.SMS_ENDPOINT
  };
  const requests: string[] = [];

  process.env.SMS_ACCESS_KEY_ID = "access-key";
  process.env.SMS_ACCESS_KEY_SECRET = "access-secret";
  process.env.SMS_SIGN_NAME = "炊火记";
  process.env.SMS_TEMPLATE_CODE = "SMS_123";
  process.env.SMS_ENDPOINT = "https://pnvs.example.test/";

  try {
    const http: SmsHttpClient = async input => {
      requests.push(String(input));
      return new Response(JSON.stringify({ Code: "OK", Success: true, Model: { VerifyResult: "PASS" } }), { status: 200 });
    };
    const gateway = new AliyunSmsGateway(http);

    const passed = await gateway.verify("13800000000", "123456", "sms-login-3");

    assert.equal(passed, true);
    const url = new URL(requests[0]);
    assert.equal(url.searchParams.get("Action"), "CheckSmsVerifyCode");
    assert.equal(url.searchParams.get("PhoneNumber"), "13800000000");
    assert.equal(url.searchParams.get("VerifyCode"), "123456");
    assert.equal(url.searchParams.get("OutId"), "sms-login-3");
    assert.ok(url.searchParams.get("Signature"));
  } finally {
    for (const [key, value] of Object.entries({
      SMS_ACCESS_KEY_ID: previous.accessKeyId,
      SMS_ACCESS_KEY_SECRET: previous.accessKeySecret,
      SMS_SIGN_NAME: previous.signName,
      SMS_TEMPLATE_CODE: previous.templateCode,
      SMS_ENDPOINT: previous.endpoint
    })) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("wraps malformed provider responses in a service unavailable error", async () => {
  const previous = {
    accessKeyId: process.env.SMS_ACCESS_KEY_ID,
    accessKeySecret: process.env.SMS_ACCESS_KEY_SECRET,
    signName: process.env.SMS_SIGN_NAME,
    templateCode: process.env.SMS_TEMPLATE_CODE,
    endpoint: process.env.SMS_ENDPOINT
  };

  process.env.SMS_ACCESS_KEY_ID = "access-key";
  process.env.SMS_ACCESS_KEY_SECRET = "access-secret";
  process.env.SMS_SIGN_NAME = "炊火记";
  process.env.SMS_TEMPLATE_CODE = "SMS_123";
  process.env.SMS_ENDPOINT = "https://pnvs.example.test/";

  try {
    const http: SmsHttpClient = async () => new Response("temporary upstream page", { status: 200 });
    const gateway = new AliyunSmsGateway(http);

    await assert.rejects(() => gateway.send("13800000000"), { message: "短信服务暂不可用" });
  } finally {
    for (const [key, value] of Object.entries({
      SMS_ACCESS_KEY_ID: previous.accessKeyId,
      SMS_ACCESS_KEY_SECRET: previous.accessKeySecret,
      SMS_SIGN_NAME: previous.signName,
      SMS_TEMPLATE_CODE: previous.templateCode,
      SMS_ENDPOINT: previous.endpoint
    })) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
