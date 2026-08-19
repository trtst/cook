import { randomInt } from "node:crypto";
import { BadRequestException, Inject, Injectable, ServiceUnavailableException, UnauthorizedException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../common/prisma.service";
import type {
  ChangeCurrentPasswordRequest,
  CodeLoginRequest,
  PasswordLoginRequest,
  SessionUser,
  WechatLoginRequest
} from "../../contracts/types";
import { UserTokenService } from "../../common/security/user-token.service";
import { hashPassword, verifyPassword } from "../../common/security/password";

const WECHAT_CODE2SESSION_URL = "https://api.weixin.qq.com/sns/jscode2session";
const WECHAT_CODE2SESSION_TIMEOUT_MS = 5000;

interface WechatCode2SessionResponse {
  openid?: unknown;
  unionid?: unknown;
  errcode?: unknown;
  errmsg?: unknown;
}

function toSessionUser(user: {
  uid: number;
  nickname: string | null;
  avatarUrl: string | null;
}): SessionUser {
  return {
    uid: user.uid,
    nickname: user.nickname,
    avatarUrl: user.avatarUrl
  };
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(UserTokenService)
    private readonly userTokenService: UserTokenService
  ) {}

  async loginWithPassword(body: PasswordLoginRequest) {
    const user = await this.prisma.user.findUnique({
      where: { phone: body.phone }
    });

    if (!user || user.status !== "ACTIVE" || !user.passwordHash || !verifyPassword(body.password, user.passwordHash)) {
      throw new UnauthorizedException("手机号或密码错误");
    }

    return this.createSessionResult(user);
  }

  async loginWithCode(body: CodeLoginRequest) {
    if (body.code !== "123456") {
      throw new BadRequestException("验证码错误");
    }

    const user = await this.findOrCreateUserByPhone(body.phone);
    if (user.status !== "ACTIVE") {
      throw new UnauthorizedException("账号不可用");
    }

    return this.createSessionResult(user);
  }

  async loginWithWechat(body: WechatLoginRequest) {
    const identity = await this.exchangeWechatCode(body.code);
    const user = await this.findOrCreateUserByWechat(identity.openid, identity.unionid);
    if (user.status !== "ACTIVE") {
      throw new UnauthorizedException("账号不可用");
    }

    return this.createSessionResult(user);
  }

  async refreshSession(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user || user.status !== "ACTIVE") {
      throw new UnauthorizedException("未登录或 token 失效");
    }

    const token = this.userTokenService.createToken(user.id, user.sessionVersion);

    return {
      token: token.token,
      expiresAt: token.expiresAt
    };
  }

  async updateCurrentPassword(userId: number, body: ChangeCurrentPasswordRequest) {
    const currentUser = await this.prisma.user.findUnique({
      where: { id: userId }
    });

    if (!currentUser || currentUser.status !== "ACTIVE" || !currentUser.passwordHash) {
      throw new UnauthorizedException("未登录或 token 失效");
    }

    if (!verifyPassword(body.currentPassword, currentUser.passwordHash)) {
      throw new BadRequestException("当前密码错误");
    }

    if (body.currentPassword === body.newPassword) {
      throw new BadRequestException("新密码不能与当前密码相同");
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: hashPassword(body.newPassword)
      },
      select: {
        updatedAt: true
      }
    });

    return {
      changedAt: user.updatedAt.toISOString()
    };
  }

  private async findOrCreateUserByPhone(phone: string) {
    const existing = await this.prisma.user.findUnique({
      where: { phone }
    });

    if (existing) return existing;

    for (let attempt = 0; attempt < 8; attempt += 1) {
      try {
        return await this.prisma.user.create({
          data: {
            phone,
            uid: this.createUid()
          }
        });
      } catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
          throw error;
        }

        const targets = Array.isArray(error.meta?.target) ? error.meta?.target.map(String) : [];
        if (targets.includes("phone")) {
          const concurrentUser = await this.prisma.user.findUnique({
            where: { phone }
          });

          if (concurrentUser) return concurrentUser;
        }

        if (!targets.includes("uid")) {
          throw error;
        }
      }
    }

    throw new BadRequestException("创建用户失败，请稍后重试");
  }

  private async findOrCreateUserByWechat(openid: string, unionid: string | null) {
    const existing = await this.prisma.user.findUnique({
      where: { openid }
    });

    if (existing) {
      if (unionid && existing.unionid !== unionid) {
        return this.prisma.user.update({
          where: { id: existing.id },
          data: { unionid }
        });
      }

      return existing;
    }

    for (let attempt = 0; attempt < 8; attempt += 1) {
      try {
        return await this.prisma.user.create({
          data: {
            openid,
            unionid,
            uid: this.createUid()
          }
        });
      } catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
          throw error;
        }

        const targets = Array.isArray(error.meta?.target) ? error.meta.target.map(String) : [];
        if (targets.includes("openid")) {
          const concurrentUser = await this.prisma.user.findUnique({
            where: { openid }
          });

          if (concurrentUser) return concurrentUser;
        }

        if (!targets.includes("uid")) {
          throw error;
        }
      }
    }

    throw new BadRequestException("创建用户失败，请稍后重试");
  }

  private async exchangeWechatCode(code: string) {
    const appId = process.env.WECHAT_APP_ID?.trim();
    const appSecret = process.env.WECHAT_APP_SECRET?.trim();
    if (!appId || !appSecret) {
      throw new ServiceUnavailableException("微信登录暂不可用");
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), WECHAT_CODE2SESSION_TIMEOUT_MS);

    try {
      const query = new URLSearchParams({
        appid: appId,
        secret: appSecret,
        js_code: code,
        grant_type: "authorization_code"
      });
      const response = await fetch(`${WECHAT_CODE2SESSION_URL}?${query.toString()}`, {
        method: "GET",
        signal: controller.signal
      });
      if (!response.ok) {
        throw new ServiceUnavailableException("微信登录暂不可用");
      }

      const payload = (await response.json()) as WechatCode2SessionResponse;
      if (typeof payload.errcode === "number" && payload.errcode !== 0) {
        throw new BadRequestException("微信登录失败，请重试");
      }

      const openid = typeof payload.openid === "string" ? payload.openid.trim() : "";
      if (!openid) {
        throw new BadRequestException("微信登录失败，请重试");
      }

      const unionid = typeof payload.unionid === "string" ? payload.unionid.trim() : "";

      return {
        openid,
        unionid: unionid || null
      };
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof ServiceUnavailableException) {
        throw error;
      }

      throw new ServiceUnavailableException("微信登录暂不可用");
    } finally {
      clearTimeout(timeout);
    }
  }

  private createSessionResult(user: { id: number; uid: number; nickname: string | null; avatarUrl: string | null; sessionVersion: number }) {
    const token = this.userTokenService.createToken(user.id, user.sessionVersion);

    return {
      token: token.token,
      expiresAt: token.expiresAt,
      user: toSessionUser(user)
    };
  }

  private createUid() {
    return randomInt(10_000_000, 100_000_000);
  }
}
