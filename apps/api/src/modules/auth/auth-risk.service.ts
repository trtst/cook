import { Inject, Injectable, HttpException } from "@nestjs/common";
import { PrismaService } from "../../common/prisma.service";
import { RateLimitService } from "../../common/rate-limit.service";

export type RiskChannel = "SMS" | "WECHAT_PHONE" | "PASSWORD";
export type RiskOperation = "SEND" | "LOGIN" | "SESSION" | "PHONE";

export interface RiskInput {
  channel: RiskChannel;
  operation?: RiskOperation;
  phone?: string;
  openid?: string;
  ip: string;
  deviceId: string;
}

interface FailureBucket {
  count: number;
  lockedUntil: number;
}

const LOGIN_FAILURE_LIMIT = 5;
const LOGIN_LOCK_MS = 15 * 60 * 1000;

@Injectable()
export class AuthRiskService {
  private readonly limiter = new RateLimitService();
  private readonly failures = new Map<string, FailureBucket>();

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async assertAllowed(input: RiskInput) {
    const operation = input.operation ?? "LOGIN";
    const phone = input.phone?.trim() || "";
    const openid = input.openid?.trim() || "";
    const ip = input.ip.trim() || "unknown";
    const deviceId = input.deviceId.trim() || "unknown";

    this.assertSecurityAllowed({ phone, openid, ip, deviceId, operation });

    if (input.channel === "SMS" && operation === "SEND") {
      this.limiter.assertAllowed({ key: `auth:sms:phone:${phone}`, limit: 1, windowMs: 60_000 });
      this.limiter.assertAllowed({ key: `auth:sms:phone-hour:${phone}`, limit: 5, windowMs: 60 * 60_000 });
      this.limiter.assertAllowed({ key: `auth:sms:phone-day:${phone}`, limit: 10, windowMs: 24 * 60 * 60_000 });
      this.limiter.assertAllowed({ key: `auth:sms:ip:${ip}`, limit: 10, windowMs: 60_000 });
      this.limiter.assertAllowed({ key: `auth:sms:device:${deviceId}`, limit: 10, windowMs: 60 * 60_000 });
    }

    if (input.channel === "WECHAT_PHONE" && operation === "PHONE") {
      this.limiter.assertAllowed({ key: `auth:wechat-phone:openid:${openid}`, limit: 5, windowMs: 24 * 60 * 60_000 });
      this.limiter.assertAllowed({ key: `auth:wechat-phone:device:${deviceId}`, limit: 5, windowMs: 24 * 60 * 60_000 });
    }
  }

  async recordPasswordFailure(input: { phone: string; ip: string; deviceId: string }) {
    await this.recordFailure({
      channel: "PASSWORD",
      scene: "PASSWORD_LOGIN",
      phone: input.phone,
      ip: input.ip,
      deviceId: input.deviceId,
      reason: "PASSWORD_INVALID"
    });
  }

  async recordFailure(input: {
    channel: RiskChannel;
    scene?: string;
    phone?: string;
    openid?: string;
    ip: string;
    deviceId: string;
    reason?: string;
  }) {
    const phone = input.phone?.trim() || "";
    const openid = input.openid?.trim() || "";
    const ip = input.ip.trim() || "unknown";
    const deviceId = input.deviceId.trim() || "unknown";
    const keys = [
      phone ? `phone:${phone}` : "",
      openid ? `openid:${openid}` : "",
      `ip:${ip}`,
      `device:${deviceId}`
    ].filter(Boolean);

    for (const key of keys) {
      const current = this.failures.get(key);
      const count = (current?.count ?? 0) + 1;
      this.failures.set(key, {
        count,
        lockedUntil: count >= LOGIN_FAILURE_LIMIT ? Date.now() + LOGIN_LOCK_MS : current?.lockedUntil ?? 0
      });
    }

    await this.record({
      scene: input.scene ?? `${input.channel}_LOGIN`,
      phone: phone || undefined,
      openid: openid || undefined,
      ip,
      deviceId,
      decision: "DENY",
      reason: input.reason ?? "LOGIN_INVALID"
    });
  }

  clearPasswordFailures(phone: string) {
    this.failures.delete(`phone:${phone.trim()}`);
  }

  async assertPasswordAllowed(input: { phone: string; ip: string; deviceId: string }) {
    return this.assertAllowed({ channel: "PASSWORD", operation: "LOGIN", ...input });
  }

  private assertSecurityAllowed(input: {
    phone: string;
    openid: string;
    ip: string;
    deviceId: string;
    operation: RiskOperation;
  }) {
    if (input.operation === "SEND") {
      this.assertFailureBucket(`phone:${input.phone}`);
      this.assertFailureBucket(`ip:${input.ip}`);
      this.assertFailureBucket(`device:${input.deviceId}`);
      return;
    }

    this.limiter.assertAllowed({ key: "auth:login:ip:" + input.ip, limit: 30, windowMs: 60_000 });
    this.limiter.assertAllowed({ key: "auth:login:device:" + input.deviceId, limit: 30, windowMs: 60_000 });
    if (input.phone) {
      this.limiter.assertAllowed({ key: "auth:login:phone:" + input.phone, limit: 15, windowMs: 60_000 });
      this.assertFailureBucket(`phone:${input.phone}`);
    }
    if (input.openid) {
      this.limiter.assertAllowed({ key: "auth:login:openid:" + input.openid, limit: 15, windowMs: 60_000 });
      this.assertFailureBucket(`openid:${input.openid}`);
    }
    this.assertFailureBucket(`ip:${input.ip}`);
    this.assertFailureBucket(`device:${input.deviceId}`);
  }

  private assertFailureBucket(key: string) {
    if (!key || key.endsWith(":unknown") || key.endsWith(":")) return;
    const failure = this.failures.get(key);
    if (failure && failure.lockedUntil > Date.now()) {
      throw new HttpException(
        {
          code: 429,
          message: "登录尝试过于频繁，请稍后重试",
          data: { retryAfterSeconds: Math.ceil((failure.lockedUntil - Date.now()) / 1000) }
        },
        429
      );
    }
  }

  async record(input: {
    scene: string;
    phone?: string;
    openid?: string;
    ip: string;
    deviceId: string;
    decision: "ALLOW" | "DENY";
    reason: string;
  }) {
    await this.prisma.authRiskEvent.create({
      data: {
        scene: input.scene,
        phone: input.phone?.trim() || null,
        openid: input.openid?.trim() || null,
        ip: input.ip,
        deviceId: input.deviceId,
        decision: input.decision,
        reason: input.reason
      }
    });
  }
}
