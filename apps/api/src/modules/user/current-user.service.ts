import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { Prisma, type User } from "@prisma/client";
import { PrismaService } from "../../common/prisma.service";
import type { MeResponse, UpdateCurrentUserRequest, UUID } from "../../contracts/types";
import { EntitlementService } from "../entitlement/entitlement.service";

type CurrentUserRecord = Pick<User, "id" | "uid" | "nickname" | "avatarUrl" | "phone" | "status">;
type CurrentUserDb = Pick<Prisma.TransactionClient, "user" | "entitlementGrant" | "diningGroupMember" | "diningGroup">;

@Injectable()
export class CurrentUserService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(EntitlementService) private readonly entitlementService: EntitlementService
  ) {}

  async getCurrent(userId: UUID): Promise<MeResponse> {
    return this.prisma.$transaction(async tx => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          uid: true,
          nickname: true,
          avatarUrl: true,
          phone: true,
          status: true
        }
      });

      return this.buildCurrent(tx, userId, user);
    });
  }

  async updateCurrent(userId: UUID, body: UpdateCurrentUserRequest): Promise<MeResponse> {
    return this.prisma.$transaction(async tx => {
      const currentUser = await tx.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          uid: true,
          nickname: true,
          avatarUrl: true,
          phone: true,
          status: true
        }
      });

      if (!currentUser || currentUser.status !== "ACTIVE") {
        throw new UnauthorizedException("未登录或 token 失效");
      }

      const user = await tx.user.update({
        where: { id: userId },
        data: {
          nickname: body.nickname,
          avatarUrl: body.avatarUrl
        },
        select: {
          id: true,
          uid: true,
          nickname: true,
          avatarUrl: true,
          phone: true,
          status: true
        }
      });

      return this.buildCurrent(tx, userId, user);
    });
  }

  async buildCurrent(
    db: CurrentUserDb,
    userId: UUID,
    user: CurrentUserRecord | null
  ): Promise<MeResponse> {
    if (!user || user.status !== "ACTIVE") {
      throw new UnauthorizedException("未登录或 token 失效");
    }

    const resolved = await this.entitlementService.resolveForUser(db, userId);

    return {
      uid: user.uid,
      nickname: user.nickname,
      avatarUrl: user.avatarUrl,
      phone: user.phone,
      display: {
        profileBackgroundUrl: null,
        homeBackgroundUrl: null,
        canUseProfileBackground: false,
        canUseHomeBackground: false
      },
      membership: {
        tier: resolved.tier,
        validUntil: resolved.validUntil
      }
    };
  }
}
