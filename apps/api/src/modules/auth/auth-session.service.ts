import { createHash, randomBytes } from "node:crypto";
import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import type { User } from "@prisma/client";
import { PrismaService } from "../../common/prisma.service";
import { UserTokenService } from "../../common/security/user-token.service";
import type { SessionUser } from "../../contracts/types";

const DEFAULT_REFRESH_EXPIRES_SECONDS = 30 * 24 * 60 * 60;

export interface AuthSessionContext {
  deviceId: string;
  ip: string;
  userAgent: string;
}

export interface AuthSessionResult {
  accessToken: string;
  refreshToken: string;
  accessExpiresAt: string;
  refreshExpiresAt: string;
  user: SessionUser;
}

type AuthUser = Pick<User, "id" | "uid" | "nickname" | "avatarUrl" | "phone" | "status" | "sessionVersion">;

function hashRefreshToken(refreshToken: string) {
  return createHash("sha256").update(refreshToken).digest("hex");
}

function refreshExpiresSeconds() {
  const configured = Number(process.env.AUTH_REFRESH_EXPIRES_SECONDS);
  return Number.isInteger(configured) && configured > 0 ? configured : DEFAULT_REFRESH_EXPIRES_SECONDS;
}

function toSessionUser(user: Pick<User, "uid" | "nickname" | "avatarUrl">): SessionUser {
  return {
    uid: user.uid,
    nickname: user.nickname,
    avatarUrl: user.avatarUrl
  };
}

@Injectable()
export class AuthSessionService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(UserTokenService) private readonly userTokenService: UserTokenService
  ) {}

  async create(user: AuthUser, context: AuthSessionContext): Promise<AuthSessionResult> {
    this.assertActiveUser(user);
    this.assertContext(context);

    const refreshToken = randomBytes(32).toString("base64url");
    const refreshExpiresAt = new Date(Date.now() + refreshExpiresSeconds() * 1000);
    const access = this.userTokenService.createToken(user.id, user.sessionVersion);

    await this.prisma.authSession.create({
      data: {
        userId: user.id,
        refreshTokenHash: hashRefreshToken(refreshToken),
        deviceId: context.deviceId,
        ip: context.ip,
        userAgent: context.userAgent || null,
        expiresAt: refreshExpiresAt
      }
    });

    return {
      accessToken: access.token,
      refreshToken,
      accessExpiresAt: access.expiresAt,
      refreshExpiresAt: refreshExpiresAt.toISOString(),
      user: toSessionUser(user)
    };
  }

  async refresh(
    refreshToken: string,
    deviceId: string,
    context: Omit<AuthSessionContext, "deviceId">
  ): Promise<AuthSessionResult> {
    const token = refreshToken.trim();
    const session = await this.prisma.authSession.findUnique({
      where: { refreshTokenHash: hashRefreshToken(token) },
      include: {
        user: {
          select: {
            id: true,
            uid: true,
            nickname: true,
            avatarUrl: true,
            phone: true,
            status: true,
            sessionVersion: true
          }
        }
      }
    });

    if (!session) throw new UnauthorizedException("刷新凭证已失效");
    if (session.revokedAt) throw new UnauthorizedException("刷新凭证已吊销");
    if (session.expiresAt.getTime() <= Date.now()) throw new UnauthorizedException("刷新凭证已失效");
    if (session.deviceId !== deviceId.trim()) throw new UnauthorizedException("刷新凭证已失效");
    this.assertActiveUser(session.user);
    this.assertContext({ deviceId, ...context });

    const nextRefreshToken = randomBytes(32).toString("base64url");
    const nextRefreshExpiresAt = new Date(Date.now() + refreshExpiresSeconds() * 1000);
    const access = this.userTokenService.createToken(session.user.id, session.user.sessionVersion);

		await this.prisma.$transaction(async transaction => {
			const claimed = await transaction.authSession.updateMany({
				where: { id: session.id, revokedAt: null, expiresAt: { gt: new Date() } },
				data: { revokedAt: new Date() }
			});
			if (claimed.count !== 1) throw new UnauthorizedException("刷新凭证已吊销");
			await transaction.authSession.create({
        data: {
          userId: session.user.id,
          refreshTokenHash: hashRefreshToken(nextRefreshToken),
          deviceId: session.deviceId,
          ip: context.ip,
          userAgent: context.userAgent || null,
          expiresAt: nextRefreshExpiresAt
        }
      });
    });

    return {
      accessToken: access.token,
      refreshToken: nextRefreshToken,
      accessExpiresAt: access.expiresAt,
      refreshExpiresAt: nextRefreshExpiresAt.toISOString(),
      user: toSessionUser(session.user)
    };
  }

  async revoke(refreshToken: string, deviceId: string) {
    const token = refreshToken.trim();
    if (!token || !deviceId.trim()) return;

    const session = await this.prisma.authSession.findUnique({
      where: { refreshTokenHash: hashRefreshToken(token) }
    });
    if (!session || session.deviceId !== deviceId.trim() || session.revokedAt) return;

    await this.prisma.authSession.update({
      where: { id: session.id },
      data: { revokedAt: new Date() }
    });
  }

  private assertActiveUser(user: Pick<User, "status">) {
    if (user.status !== "ACTIVE") throw new UnauthorizedException("账号不可用");
  }

  private assertContext(context: AuthSessionContext) {
    if (!context.deviceId.trim()) throw new UnauthorizedException("设备信息无效");
    if (!context.ip.trim()) throw new UnauthorizedException("请求来源无效");
  }
}

export { hashRefreshToken };
