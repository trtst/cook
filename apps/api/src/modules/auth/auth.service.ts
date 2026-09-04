import { createHash, randomBytes, randomInt } from "node:crypto";
import { BadRequestException, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../common/prisma.service";
import { maskPhone } from "../../common/phone";
import { hashPassword, verifyPassword } from "../../common/security/password";
import type {
  AuthMeResponse,
  AuthPasswordLoginRequest,
  AuthSessionResult,
  ChangeCurrentPasswordRequest,
  RefreshAuthSessionRequest,
  SetPasswordRequest,
  SmsLoginRequest,
  SmsSendRequest,
  WechatPhoneLoginRequest,
  WechatSessionRequest,
  WechatSessionResult
} from "../../contracts/types";
import { AuthRiskService } from "./auth-risk.service";
import { AuthSessionService, type AuthSessionContext } from "./auth-session.service";
import { SmsAuthService } from "./sms-auth.service";
import { WechatAuthService, type WechatIdentitySession } from "./wechat-auth.service";

const WECHAT_SESSION_EXPIRES_MS = 10 * 60 * 1000;

export interface AuthRequestContext {
  ip: string;
  userAgent: string;
}

type AuthUser = {
  id: number;
  uid: number;
  nickname: string | null;
  avatarUrl: string | null;
  phone: string | null;
  passwordHash: string | null;
  status: "ACTIVE" | "DISABLED";
  sessionVersion: number;
};

function hashSecret(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function toSessionContext(body: { deviceId: string }, context: AuthRequestContext): AuthSessionContext {
  return {
    deviceId: body.deviceId,
    ip: context.ip,
    userAgent: context.userAgent
  };
}

function assertPhone(phone: string) {
  if (!/^1[3-9]\d{9}$/.test(phone)) throw new BadRequestException("请输入正确的手机号");
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuthSessionService) private readonly authSession: AuthSessionService,
    @Inject(WechatAuthService) private readonly wechatAuth: WechatAuthService,
    @Inject(SmsAuthService) private readonly smsAuth: SmsAuthService,
    @Inject(AuthRiskService) private readonly risk: AuthRiskService
  ) {}

  async loginWithPassword(body: AuthPasswordLoginRequest, context: AuthRequestContext): Promise<AuthSessionResult> {
    assertPhone(body.phone);
    await this.risk.assertAllowed({
      channel: "PASSWORD",
      operation: "LOGIN",
      phone: body.phone,
      ip: context.ip,
      deviceId: body.deviceId
    });

    const user = await this.prisma.user.findUnique({ where: { phone: body.phone } });
    if (!user || user.status !== "ACTIVE" || !user.passwordHash || !verifyPassword(body.password, user.passwordHash)) {
      await this.risk.recordPasswordFailure({ phone: body.phone, ip: context.ip, deviceId: body.deviceId });
      throw new UnauthorizedException("手机号或密码错误");
    }

    this.risk.clearPasswordFailures(body.phone);
    await this.risk.record({
      scene: "PASSWORD_LOGIN",
      phone: body.phone,
      ip: context.ip,
      deviceId: body.deviceId,
      decision: "ALLOW",
      reason: "PASSWORD_VALID"
    });
    return this.authSession.create(user, toSessionContext(body, context));
  }

  async setPassword(userId: number, body: SetPasswordRequest) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { status: true, passwordHash: true }
    });
    this.assertActiveUser(user);
    if (user.passwordHash) throw new BadRequestException("密码已设置，请使用修改密码");

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: hashPassword(body.password) },
      select: { updatedAt: true }
    });

    return { changedAt: updated.updatedAt.toISOString() };
  }

  async changePassword(userId: number, body: ChangeCurrentPasswordRequest) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { status: true, passwordHash: true }
    });
    this.assertActiveUser(user);
    if (!user.passwordHash || !verifyPassword(body.currentPassword, user.passwordHash)) {
      throw new BadRequestException("当前密码错误");
    }
    if (body.currentPassword === body.newPassword) {
      throw new BadRequestException("新密码不能与当前密码相同");
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: hashPassword(body.newPassword) },
      select: { updatedAt: true }
    });

    return { changedAt: updated.updatedAt.toISOString() };
  }

  async updateCurrentPassword(userId: number, body: ChangeCurrentPasswordRequest) {
    return this.changePassword(userId, body);
  }

  async wechatSession(body: WechatSessionRequest, context: AuthRequestContext): Promise<WechatSessionResult> {
    await this.risk.assertAllowed({
      channel: "WECHAT_PHONE",
      operation: "SESSION",
      ip: context.ip,
      deviceId: body.deviceId
    });

    let identity: WechatIdentitySession;
    try {
      identity = await this.wechatAuth.login(body.code);
    } catch (error) {
      if (error instanceof BadRequestException) {
        await this.risk.recordFailure({
          channel: "WECHAT_PHONE",
          scene: "WECHAT_SESSION",
          ip: context.ip,
          deviceId: body.deviceId,
          reason: "WECHAT_CODE_INVALID"
        });
      }
      throw error;
    }
    const user = await this.findWechatUser(identity);

    if (user) {
      if (user.status !== "ACTIVE") {
        await this.risk.record({
          scene: "WECHAT_SESSION",
          openid: identity.openid,
          ip: context.ip,
          deviceId: body.deviceId,
          decision: "DENY",
          reason: "USER_BLOCKED"
        });
        return { status: "BLOCKED", session: null, wechatSessionId: null, retryAfterSeconds: null };
      }

      await this.risk.record({
        scene: "WECHAT_SESSION",
        openid: identity.openid,
        ip: context.ip,
        deviceId: body.deviceId,
        decision: "ALLOW",
        reason: "IDENTITY_BOUND"
      });
      return {
        status: "BOUND",
        session: await this.authSession.create(user, toSessionContext(body, context)),
        wechatSessionId: null,
        retryAfterSeconds: null
      };
    }

    const wechatSessionId = randomBytes(32).toString("base64url");
    await this.prisma.wechatLoginSession.create({
      data: {
        appid: identity.appid,
        openid: identity.openid,
        unionid: identity.unionid,
        sessionKeyHash: hashSecret(identity.sessionKey),
        wechatSessionIdHash: hashSecret(wechatSessionId),
        expiresAt: new Date(Date.now() + WECHAT_SESSION_EXPIRES_MS),
        consumedAt: null
      }
    });
    await this.risk.record({
      scene: "WECHAT_SESSION",
      openid: identity.openid,
      ip: context.ip,
      deviceId: body.deviceId,
      decision: "ALLOW",
      reason: "IDENTITY_UNBOUND"
    });

    return { status: "UNBOUND", session: null, wechatSessionId, retryAfterSeconds: null };
  }

  async loginWithWechatPhone(body: WechatPhoneLoginRequest, context: AuthRequestContext): Promise<AuthSessionResult> {
    const wechatSession = await this.prisma.wechatLoginSession.findUnique({
      where: { wechatSessionIdHash: hashSecret(body.wechatSessionId) }
    });
    this.assertWechatSession(wechatSession);
    await this.risk.assertAllowed({
      channel: "WECHAT_PHONE",
      operation: "PHONE",
      openid: wechatSession.openid,
      ip: context.ip,
      deviceId: body.deviceId
    });

    let phoneResult: { phone: string };
    try {
      phoneResult = await this.wechatAuth.getPhoneNumber(body.phoneCode);
    } catch (error) {
      if (error instanceof BadRequestException) {
        await this.risk.recordFailure({
          channel: "WECHAT_PHONE",
          scene: "WECHAT_PHONE_LOGIN",
          openid: wechatSession.openid,
          ip: context.ip,
          deviceId: body.deviceId,
          reason: "WECHAT_PHONE_CODE_INVALID"
        });
      }
      throw error;
    }
    assertPhone(phoneResult.phone);
    const user = await this.prisma.$transaction(async tx => {
      const currentUser = await this.findOrCreateUserByPhone(tx, phoneResult.phone);
      if (currentUser.status !== "ACTIVE") throw new UnauthorizedException("账号不可用");
      await this.bindWechatIdentity(tx, currentUser.id, {
        appid: wechatSession.appid,
        openid: wechatSession.openid,
        unionid: wechatSession.unionid
      });
      const consumed = await tx.wechatLoginSession.updateMany({
        where: { id: wechatSession.id, consumedAt: null, expiresAt: { gt: new Date() } },
        data: { consumedAt: new Date() }
      });
      if (consumed.count !== 1) throw new BadRequestException("微信授权已使用");
      return currentUser;
    });

    if (user.status !== "ACTIVE") throw new UnauthorizedException("账号不可用");
    await this.risk.record({
      scene: "WECHAT_PHONE_LOGIN",
      phone: phoneResult.phone,
      openid: wechatSession.openid,
      ip: context.ip,
      deviceId: body.deviceId,
      decision: "ALLOW",
      reason: "PHONE_AUTHORIZED"
    });
    return this.authSession.create(user, toSessionContext(body, context));
  }

  async sendSmsCode(body: SmsSendRequest, context: AuthRequestContext) {
    assertPhone(body.phone);
    return this.smsAuth.sendLoginCode(body.phone, { ip: context.ip, deviceId: body.deviceId });
  }

  async loginWithSms(body: SmsLoginRequest, context: AuthRequestContext): Promise<AuthSessionResult> {
    assertPhone(body.phone);
    await this.risk.assertAllowed({
      channel: "SMS",
      operation: "LOGIN",
      phone: body.phone,
      ip: context.ip,
      deviceId: body.deviceId
    });
    try {
      await this.smsAuth.consumeLoginCode(body.phone, body.code);
    } catch (error) {
      await this.risk.recordFailure({
        channel: "SMS",
        scene: "SMS_LOGIN",
        phone: body.phone,
        ip: context.ip,
        deviceId: body.deviceId,
        reason: "CODE_INVALID"
      });
      throw error;
    }

    const user = await this.prisma.$transaction(async tx => {
      const currentUser = await this.findOrCreateUserByPhone(tx, body.phone);
      if (currentUser.status !== "ACTIVE") throw new UnauthorizedException("账号不可用");
      if (body.wechatSessionId) {
        const wechatSession = await tx.wechatLoginSession.findUnique({
          where: { wechatSessionIdHash: hashSecret(body.wechatSessionId) }
        });
        this.assertWechatSession(wechatSession);
        await this.bindWechatIdentity(tx, currentUser.id, {
          appid: wechatSession.appid,
          openid: wechatSession.openid,
          unionid: wechatSession.unionid
        });
        const consumed = await tx.wechatLoginSession.updateMany({
          where: { id: wechatSession.id, consumedAt: null, expiresAt: { gt: new Date() } },
          data: { consumedAt: new Date() }
        });
        if (consumed.count !== 1) throw new BadRequestException("微信授权已使用");
      }
      return currentUser;
    });

    if (user.status !== "ACTIVE") throw new UnauthorizedException("账号不可用");
    this.risk.clearPasswordFailures(body.phone);
    await this.risk.record({
      scene: "SMS_LOGIN",
      phone: body.phone,
      ip: context.ip,
      deviceId: body.deviceId,
      decision: "ALLOW",
      reason: "CODE_VALID"
    });
    return this.authSession.create(user, toSessionContext(body, context));
  }

  async refresh(body: RefreshAuthSessionRequest, context: AuthRequestContext) {
    return this.authSession.refresh(body.refreshToken, body.deviceId, context);
  }

  async logout(body: RefreshAuthSessionRequest) {
    await this.authSession.revoke(body.refreshToken, body.deviceId);
  }

  async getMe(userId: number): Promise<AuthMeResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, uid: true, nickname: true, avatarUrl: true, phone: true, status: true }
    });
    this.assertActiveUser(user);
    return {
      id: user.id,
      uid: user.uid,
      nickname: user.nickname,
      avatarUrl: user.avatarUrl,
      phone: maskPhone(user.phone),
      status: user.status
    };
  }

  private async findWechatUser(identity: WechatIdentitySession) {
    const bound = await this.prisma.userWechatIdentity.findUnique({
      where: { appid_openid: { appid: identity.appid, openid: identity.openid } },
      include: { user: true }
    });
    if (bound) return bound.user;

    // Existing deployments stored the one-app identity on User. Promote that known legacy fact lazily.
    const legacyUser = await this.prisma.user.findUnique({ where: { openid: identity.openid } });
    if (!legacyUser) return null;

    await this.prisma.userWechatIdentity.upsert({
      where: { appid_openid: { appid: identity.appid, openid: identity.openid } },
      create: {
        userId: legacyUser.id,
        appid: identity.appid,
        openid: identity.openid,
        unionid: identity.unionid ?? legacyUser.unionid
      },
      update: { unionid: identity.unionid ?? legacyUser.unionid }
    });
    return legacyUser;
  }

  private async findOrCreateUserByPhone(db: Pick<Prisma.TransactionClient, "user">, phone: string): Promise<AuthUser> {
    const existing = await db.user.findUnique({ where: { phone } });
    if (existing) return existing as AuthUser;

    for (let attempt = 0; attempt < 8; attempt += 1) {
      try {
        return (await db.user.create({ data: { phone, uid: this.createUid() } })) as AuthUser;
      } catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;
        const targets = Array.isArray(error.meta?.target) ? error.meta.target.map(String) : [];
        if (targets.includes("phone")) {
          const concurrentUser = await db.user.findUnique({ where: { phone } });
          if (concurrentUser) return concurrentUser as AuthUser;
        }
        if (!targets.includes("uid")) throw error;
      }
    }

    throw new BadRequestException("创建用户失败，请稍后重试");
  }

  private async bindWechatIdentity(
    db: Pick<Prisma.TransactionClient, "user" | "userWechatIdentity">,
    userId: number,
    identity: Pick<WechatIdentitySession, "appid" | "openid" | "unionid">
  ) {
    const existing = await db.userWechatIdentity.findUnique({
      where: { appid_openid: { appid: identity.appid, openid: identity.openid } }
    });
    if (existing && existing.userId !== userId) throw new BadRequestException("微信已绑定其他账号");

    if (existing) {
      await db.userWechatIdentity.update({
        where: { id: existing.id },
        data: { unionid: identity.unionid }
      });
    } else {
      await db.userWechatIdentity.create({
        data: {
          userId,
          appid: identity.appid,
          openid: identity.openid,
          unionid: identity.unionid
        }
      });
    }

    const currentUser = await db.user.findUnique({ where: { id: userId }, select: { openid: true } });
    if (!currentUser?.openid) {
      await db.user.update({ where: { id: userId }, data: { openid: identity.openid, unionid: identity.unionid } });
    }
  }

  private assertWechatSession(session: { id: number; appid: string; openid: string; unionid: string | null; consumedAt: Date | null; expiresAt: Date } | null): asserts session is NonNullable<typeof session> {
    if (!session) throw new BadRequestException("微信授权已失效");
    if (session.consumedAt) throw new BadRequestException("微信授权已使用");
    if (session.expiresAt.getTime() <= Date.now()) throw new BadRequestException("微信授权已过期");
  }

  private assertActiveUser(user: { status: "ACTIVE" | "DISABLED" } | null): asserts user is { status: "ACTIVE" } {
    if (!user || user.status !== "ACTIVE") throw new UnauthorizedException("账号不可用");
  }

  private createUid() {
    return randomInt(10_000_000, 100_000_000);
  }
}
