import { createHmac, randomInt, randomUUID } from "node:crypto";
import { BadRequestException, Inject, Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import { PrismaService } from "../../common/prisma.service";
import { AuthRiskService } from "./auth-risk.service";
import { AuthCodeScene } from "@prisma/client";

export const SMS_HTTP_CLIENT = Symbol("SMS_HTTP_CLIENT");
export const SMS_GATEWAY = Symbol("SMS_GATEWAY");
export type SmsHttpClient = (input: string | URL, init?: RequestInit) => Promise<Response>;
export interface SmsGateway {
  send(phone: string): Promise<{ providerOutId: string }>;
  verify(phone: string, code: string, providerOutId: string | null): Promise<boolean>;
}

const SMS_ENDPOINT = "https://dypnsapi.aliyuncs.com/";
const SMS_CODE_EXPIRES_MS = 5 * 60 * 1000;

function encodeRpc(value: string) {
  return encodeURIComponent(value).replace(/[!'()*]/g, char => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}

export class AliyunSmsGateway implements SmsGateway {
  private readonly logger = new Logger(AliyunSmsGateway.name);

  constructor(private readonly http: SmsHttpClient) {}

  async send(phone: string) {
    const outId = `sms-login-${randomUUID()}`;
    const payload = await this.call({
      Action: "SendSmsVerifyCode",
      PhoneNumber: phone,
      SignName: this.config().signName,
      TemplateCode: this.config().templateCode,
      TemplateParam: JSON.stringify({ code: "##code##", min: "5" }),
      CodeType: "1",
      CodeLength: "6",
      ValidTime: "300",
      Interval: "60",
      ReturnVerifyCode: "false",
      OutId: outId
    });
    if (payload.Code !== "OK") throw new ServiceUnavailableException("短信发送失败");
    return { providerOutId: outId };
  }

  async verify(phone: string, code: string, providerOutId: string | null) {
    const params: Record<string, string> = {
      Action: "CheckSmsVerifyCode",
      PhoneNumber: phone,
      VerifyCode: code
    };
    if (providerOutId) params.OutId = providerOutId;
    const payload = await this.call(params);
    if (payload.Code !== "OK") throw new ServiceUnavailableException("短信服务暂不可用");
    return payload.Success === true && payload.Model?.VerifyResult === "PASS";
  }

  private config() {
    const accessKeyId = process.env.SMS_ACCESS_KEY_ID?.trim();
    const accessKeySecret = process.env.SMS_ACCESS_KEY_SECRET?.trim();
    const signName = process.env.SMS_SIGN_NAME?.trim();
    const templateCode = process.env.SMS_TEMPLATE_CODE?.trim();
    if (!accessKeyId || !accessKeySecret || !signName || !templateCode) {
      throw new ServiceUnavailableException("短信服务暂不可用");
    }
    return { accessKeyId, accessKeySecret, signName, templateCode };
  }

  private async call(params: Record<string, string>) {
    const { accessKeyId, accessKeySecret } = this.config();

    const signedParams: Record<string, string> = {
      ...params,
      AccessKeyId: accessKeyId,
      Format: "JSON",
      RegionId: "cn-hangzhou",
      SignatureMethod: "HMAC-SHA1",
      SignatureNonce: randomInt(1, 2_147_483_647).toString(),
      SignatureVersion: "1.0",
      Timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
      Version: "2017-05-25"
    };
    const canonical = Object.keys(signedParams)
      .sort()
      .map(key => `${encodeRpc(key)}=${encodeRpc(signedParams[key])}`)
      .join("&");
    const stringToSign = `GET&%2F&${encodeRpc(canonical)}`;
    signedParams.Signature = createHmac("sha1", `${accessKeySecret}&`).update(stringToSign).digest("base64");
    const query = Object.keys(signedParams)
      .sort()
      .map(key => `${encodeRpc(key)}=${encodeRpc(signedParams[key])}`)
      .join("&");

    const endpoint = process.env.SMS_ENDPOINT?.trim() || SMS_ENDPOINT;
    const separator = endpoint.includes("?") ? "&" : "?";
    const response = await this.http(`${endpoint}${separator}${query}`, { method: "GET" });
    const rawBody = await response.text();
    const payload = parseSmsBody(rawBody);

    if (!response.ok) {
      this.logger.error(`Aliyun SMS HTTP ${response.status}: ${smsPayloadSummary(payload, rawBody)}`);
      throw new ServiceUnavailableException("短信服务暂不可用");
    }
    return payload as { Code?: unknown; Success?: unknown; Model?: { VerifyResult?: unknown } };
  }
}

function parseSmsBody(rawBody: string) {
  if (!rawBody.trim()) return {};
  try {
    return JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function smsPayloadSummary(payload: Record<string, unknown>, rawBody: string) {
  return JSON.stringify({
    Code: payload.Code,
    Message: payload.Message,
    RequestId: payload.RequestId,
    HostId: payload.HostId,
    bodyPrefix: rawBody.slice(0, 120)
  });
}

@Injectable()
export class SmsAuthService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuthRiskService) private readonly risk: AuthRiskService,
    @Inject(SMS_GATEWAY) private readonly gateway: SmsGateway
  ) {}

  async sendLoginCode(phone: string, context: { ip: string; deviceId: string }) {
    await this.risk.assertAllowed({ channel: "SMS", operation: "SEND", phone, ip: context.ip, deviceId: context.deviceId });
    const challenge = await this.gateway.send(phone);
    await this.prisma.smsCode.create({
      data: {
        phone,
        scene: AuthCodeScene.LOGIN,
        codeHash: null,
        providerOutId: challenge.providerOutId,
        expiresAt: new Date(Date.now() + SMS_CODE_EXPIRES_MS),
        consumedAt: null,
        ip: context.ip,
        deviceId: context.deviceId
      }
    });
    return { cooldownSeconds: 60 };
  }

  async consumeLoginCode(phone: string, code: string) {
    if (!/^\d{6}$/.test(code)) throw new BadRequestException("验证码错误");
    const record = await this.prisma.smsCode.findFirst({
      where: { phone, scene: AuthCodeScene.LOGIN },
      orderBy: { createdAt: "desc" }
    });
    if (!record) throw new BadRequestException("验证码错误");
    if (record.consumedAt) throw new BadRequestException("验证码已使用");
    if (record.expiresAt.getTime() <= Date.now()) throw new BadRequestException("验证码已过期");
    const passed = await this.gateway.verify(phone, code, record.providerOutId);
    if (!passed) throw new BadRequestException("验证码错误");

    const consumed = await this.prisma.smsCode.updateMany({
      where: {
        id: record.id,
        consumedAt: null,
        expiresAt: { gt: new Date() }
      },
      data: { consumedAt: new Date() }
    });
    if (consumed.count !== 1) throw new BadRequestException("验证码已使用");
  }
}
