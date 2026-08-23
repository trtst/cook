import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { Prisma, type User } from "@prisma/client";
import { maskPhone } from "../../common/phone";
import { PrismaService } from "../../common/prisma.service";
import type { MeResponse, StorageUsageSummary, UpdateCurrentUserRequest, UUID } from "../../contracts/types";
import { EntitlementService } from "../entitlement/entitlement.service";

type CurrentUserRecord = Pick<User, "id" | "uid" | "nickname" | "avatarUrl" | "phone" | "status">;
type CurrentUserDb = Pick<Prisma.TransactionClient, "user" | "entitlementGrant" | "diningGroupMember" | "diningGroup" | "storageLedger">;

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

  async getStorageUsage(userId: UUID): Promise<StorageUsageSummary> {
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
      this.assertActiveUser(user);

      const [resolved, storageRows] = await Promise.all([
        this.entitlementService.resolveForUser(tx, userId),
        tx.storageLedger.findMany({
          where: { userId },
          select: {
            module: true,
            usedBytes: true
          }
        })
      ]);

      const byModuleMap = new Map<string, number>();
      for (const row of storageRows) {
        byModuleMap.set(row.module, (byModuleMap.get(row.module) ?? 0) + row.usedBytes);
      }
      const usedBytes = Array.from(byModuleMap.values()).reduce((total, value) => total + value, 0);

      return {
        state: usedBytes > resolved.storageLimitBytes ? "OVER_STORAGE_READONLY" : "NORMAL",
        usedBytes,
        limitBytes: resolved.storageLimitBytes,
        remainingBytes: Math.max(0, resolved.storageLimitBytes - usedBytes),
        byModule: Array.from(byModuleMap.entries()).map(([module, moduleUsedBytes]) => ({
          module: module as StorageUsageSummary["byModule"][number]["module"],
          usedBytes: moduleUsedBytes
        })),
        calculatedAt: new Date().toISOString()
      };
    });
  }

  async buildCurrent(
    db: CurrentUserDb,
    userId: UUID,
    user: CurrentUserRecord | null
  ): Promise<MeResponse> {
    this.assertActiveUser(user);

    const resolved = await this.entitlementService.resolveForUser(db, userId);

    return {
      uid: user.uid,
      nickname: user.nickname,
      avatarUrl: user.avatarUrl,
      phone: maskPhone(user.phone),
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

  private assertActiveUser(user: CurrentUserRecord | null): asserts user is CurrentUserRecord {
    if (!user || user.status !== "ACTIVE") {
      throw new UnauthorizedException("未登录或 token 失效");
    }
  }
}
