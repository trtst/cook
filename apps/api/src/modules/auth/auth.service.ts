import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import type { PasswordLoginRequest, UserBasic } from "@next-meal/api-client";
import { PrismaService } from "../../common/prisma.service";
import { UserTokenService } from "../../common/security/user-token.service";
import { verifyPassword } from "../../common/security/password";

function toUserBasic(user: {
  id: string;
  uid: number;
  nickname: string | null;
  avatarUrl: string | null;
  phone: string | null;
}): UserBasic {
  return {
    id: user.id,
    uid: user.uid,
    nickname: user.nickname,
    avatarUrl: user.avatarUrl,
    phone: user.phone
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

    const token = this.userTokenService.createToken(user.id);

    return {
      token: token.token,
      expiresAt: token.expiresAt,
      userId: user.id,
      user: toUserBasic(user)
    };
  }

  async getCurrentUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user || user.status !== "ACTIVE") {
      throw new UnauthorizedException("未登录或 token 失效");
    }

    return toUserBasic(user);
  }

  async refreshSession(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user || user.status !== "ACTIVE") {
      throw new UnauthorizedException("未登录或 token 失效");
    }

    const token = this.userTokenService.createToken(user.id);

    return {
      token: token.token,
      expiresAt: token.expiresAt
    };
  }

  async updateCurrentUser(userId: string, body: Partial<UserBasic>) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        nickname: body.nickname,
        avatarUrl: body.avatarUrl,
        phone: body.phone
      }
    });

    return toUserBasic(user);
  }
}
