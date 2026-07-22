import { BadRequestException, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { PrismaService } from "../../common/prisma.service";
import type {
  ChangeCurrentPasswordRequest,
  PasswordLoginRequest,
  UpdateCurrentUserRequest,
  UserBasic
} from "../../contracts/types";
import { UserTokenService } from "../../common/security/user-token.service";
import { hashPassword, verifyPassword } from "../../common/security/password";

function toUserBasic(user: {
  uid: number;
  nickname: string | null;
  avatarUrl: string | null;
  phone: string | null;
}): UserBasic {
  return {
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

  async updateCurrentUser(userId: string, body: UpdateCurrentUserRequest) {
    const currentUser = await this.prisma.user.findUnique({
      where: { id: userId }
    });

    if (!currentUser || currentUser.status !== "ACTIVE") {
      throw new UnauthorizedException("未登录或 token 失效");
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        nickname: body.nickname,
        avatarUrl: body.avatarUrl
      }
    });

    return toUserBasic(user);
  }

  async updateCurrentPassword(userId: string, body: ChangeCurrentPasswordRequest) {
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
}
