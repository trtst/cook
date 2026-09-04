import { BadRequestException, ConflictException, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { Prisma, type User } from "@prisma/client";
import { PrismaService } from "../../common/prisma.service";
import type { MeResponse, StorageUsageSummary, UpdateCurrentUserRequest, UUID } from "../../contracts/types";
import { EntitlementService } from "../entitlement/entitlement.service";

type CurrentUserRecord = Pick<User, "id" | "uid" | "nickname" | "avatarUrl" | "cookNo" | "bio" | "gender" | "birthDate" | "passwordHash" | "status">;
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
          cookNo: true,
          bio: true,
          gender: true,
          birthDate: true,
          passwordHash: true,
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
          cookNo: true,
          bio: true,
          gender: true,
          birthDate: true,
          passwordHash: true,
          status: true
        }
      });

      if (!currentUser || currentUser.status !== "ACTIVE") {
        throw new UnauthorizedException("未登录或 token 失效");
      }

      this.assertCookNoCanChange(currentUser, body);
      const patch = this.buildPatch(body);
      const user = await this.updateUser(tx, userId, patch);

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
          cookNo: true,
          bio: true,
          gender: true,
          birthDate: true,
          passwordHash: true,
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
      avatarUrl: user.avatarUrl,
      profile: {
        cookNo: user.cookNo ?? String(user.uid),
        bio: user.bio,
        gender: user.gender as MeResponse["profile"]["gender"],
        birthDate: user.birthDate ? toDateText(user.birthDate) : null
      },
      hasPassword: Boolean(user.passwordHash),
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

  private buildPatch(body: UpdateCurrentUserRequest) {
    const patch: Prisma.UserUpdateInput = {};
    if (body.nickname !== undefined) patch.nickname = body.nickname.trim();
    if (body.cookNo !== undefined) patch.cookNo = body.cookNo.trim();
    if (body.bio !== undefined) patch.bio = body.bio === null ? null : body.bio.trim();
    if (body.gender !== undefined) patch.gender = body.gender;
    if (body.birthDate !== undefined) {
      patch.birthDate = body.birthDate === null ? null : this.parseBirthDate(body.birthDate);
    }
    if (Object.keys(patch).length === 0) {
      throw new BadRequestException("至少提供一个可修改字段");
    }
    return patch;
  }

  private assertCookNoCanChange(user: CurrentUserRecord, body: UpdateCurrentUserRequest) {
    if (body.cookNo === undefined) return;
    const nextCookNo = body.cookNo.trim();
    const currentCookNo = user.cookNo?.trim() ?? "";
    if (!currentCookNo || currentCookNo === String(user.uid) || currentCookNo === nextCookNo) return;
    throw new BadRequestException("炊火号只能设置一次");
  }

  private parseBirthDate(value: string) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) throw new BadRequestException("生日格式不正确");
    const birthDate = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
    if (
      birthDate.getUTCFullYear() !== Number(match[1]) ||
      birthDate.getUTCMonth() !== Number(match[2]) - 1 ||
      birthDate.getUTCDate() !== Number(match[3])
    ) {
      throw new BadRequestException("生日格式不正确");
    }
    const today = dateOnly(this.currentDate());
    if (birthDate.getTime() > today.getTime()) {
      throw new BadRequestException("生日不能晚于今天");
    }
    if (ageOf(birthDate, today) <= 14) {
      throw new BadRequestException("未满14岁需实名认证");
    }
    return birthDate;
  }

  private async updateUser(db: CurrentUserDb, userId: UUID, patch: Prisma.UserUpdateInput) {
    try {
      return await db.user.update({
        where: { id: userId },
        data: patch,
        select: {
          id: true,
          uid: true,
          nickname: true,
          avatarUrl: true,
          cookNo: true,
          bio: true,
          gender: true,
          birthDate: true,
          passwordHash: true,
          status: true
        }
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const targets = Array.isArray(error.meta?.target) ? error.meta.target.map(String) : [];
        if (targets.includes("cook_no") || targets.includes("cookNo")) {
          throw new ConflictException("炊火号已被占用");
        }
      }
      throw error;
    }
  }

  protected currentDate() {
    return new Date();
  }
}

function dateOnly(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function toDateText(value: Date) {
  return value.toISOString().slice(0, 10);
}

function ageOf(birthDate: Date, today: Date) {
  let age = today.getUTCFullYear() - birthDate.getUTCFullYear();
  const monthDiff = today.getUTCMonth() - birthDate.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getUTCDate() < birthDate.getUTCDate())) {
    age -= 1;
  }
  return age;
}
