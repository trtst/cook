import { Inject, Injectable } from "@nestjs/common";
import { EntitlementTier, type EntitlementGrant, type Prisma } from "@prisma/client";
import type { RequestContext } from "../../common/auth-context";
import { completeIdempotentOperation, getIdempotentResult, startIdempotentOperation } from "../../common/idempotency";
import { PrismaService } from "../../common/prisma.service";
import { rateLimitService } from "../../common/rate-limit.service";
import type { RedeemMembershipCodeResult, UserMembership, UUID } from "../../contracts/types";
import { isAllowedMembershipSkuPreset } from "./membership-code.catalog";
import { hashCode, normalizeCode } from "./membership-code.utils";

const INVALID_REDEEM_MESSAGE = "兑换码无效或不可用";
const REDEEM_OPERATION_TYPE = "membership-code-redeem";
const REDEEM_COOLDOWN_MESSAGE = "30天内仅可兑换一次";
const TRIAL_DAY_LIMIT = 7;
const FORMAL_REDEEM_COOLDOWN_DAYS = 30;
const REDEEM_COOLDOWN_CODE = 4601;
const INVALID_REDEEM_CODE = 4602;

type GrantPlan = {
  tier: EntitlementTier;
  startsAt: Date;
  endsAt: Date;
};

type RedeemMembershipCodeOutcome =
  | { ok: true; result: RedeemMembershipCodeResult }
  | { ok: false; code: number; message: string };

class RedeemBusinessError extends Error {
  constructor(
    readonly code: number,
    message: string
  ) {
    super(message);
    this.name = "RedeemBusinessError";
  }
}

function addDays(base: Date, days: number) {
  return new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
}

function isGrantActive(grant: Pick<EntitlementGrant, "tier" | "endsAt"> | null, now: Date) {
  if (!grant) return false;
  return grant.tier !== "FREE" && (grant.endsAt === null || grant.endsAt > now);
}

function toMembership(tier: EntitlementTier, endsAt: Date | null): UserMembership {
  return {
    tier,
    validUntil: endsAt?.toISOString() ?? null
  };
}

async function lockRedeemScope(tx: Prisma.TransactionClient, key: string) {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))::text`;
}

@Injectable()
export class MembershipCodeService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async redeemCurrent(userId: UUID, operationId: string, requestContext: RequestContext | undefined, code: string) {
    const normalizedCode = normalizeCode(code);
    this.assertAllowed(userId, requestContext);

    return this.prisma.$transaction(async tx => {
      const requestHash = JSON.stringify({ code: normalizedCode });
      const existing = await getIdempotentResult<RedeemMembershipCodeOutcome>(tx, operationId, REDEEM_OPERATION_TYPE, userId, null, requestHash);

      if (existing) {
        return existing;
      }

      await startIdempotentOperation(tx, operationId, REDEEM_OPERATION_TYPE, userId, null, requestHash);

      let result: RedeemMembershipCodeOutcome;
      try {
        result = {
          ok: true,
          result: await this.redeemInTx(tx, userId, normalizedCode)
        };
      } catch (error) {
        if (!(error instanceof RedeemBusinessError)) {
          throw error;
        }
        result = {
          ok: false,
          code: error.code,
          message: error.message
        };
      }

      await completeIdempotentOperation(tx, operationId, REDEEM_OPERATION_TYPE, userId, null, requestHash, result);
      return result;
    });
  }

  private assertAllowed(userId: UUID, requestContext: RequestContext | undefined) {
    const ip = requestContext?.ip ?? "unknown";
    const platform = requestContext?.platform ?? "unknown";
    const userAgent = requestContext?.userAgent ?? "unknown";

    rateLimitService.assertAllowed({
      key: `membership-redeem:user:${userId}`,
      limit: 6,
      windowMs: 60_000
    });
    rateLimitService.assertAllowed({
      key: `membership-redeem:ip:${ip}`,
      limit: 20,
      windowMs: 60_000
    });
    rateLimitService.assertAllowed({
      key: `membership-redeem:device:${platform}:${userAgent}`,
      limit: 10,
      windowMs: 60_000
    });
  }

  private async redeemInTx(tx: Prisma.TransactionClient, userId: UUID, normalizedCode: string): Promise<RedeemMembershipCodeResult> {
    const now = new Date();
    const codeHash = hashCode(normalizedCode);

    await lockRedeemScope(tx, `membership-redeem:user:${userId}`);
    await lockRedeemScope(tx, `membership-redeem:code:${codeHash}`);

    const membershipCode = await tx.membershipCode.findUnique({
      where: { codeHash },
      include: {
        batch: {
          include: {
            sku: true
          }
        }
      }
    });

    if (!membershipCode || membershipCode.status !== "ACTIVE") {
      throw new RedeemBusinessError(INVALID_REDEEM_CODE, INVALID_REDEEM_MESSAGE);
    }

    if (
      !membershipCode.batch.redeemEnabled ||
      !membershipCode.batch.sku.redeemEnabled ||
      !isAllowedMembershipSkuPreset(membershipCode.batch.sku) ||
      (membershipCode.batch.startsAt && membershipCode.batch.startsAt > now) ||
      (membershipCode.batch.endsAt && membershipCode.batch.endsAt <= now)
    ) {
      throw new RedeemBusinessError(INVALID_REDEEM_CODE, INVALID_REDEEM_MESSAGE);
    }

    if (membershipCode.batch.sku.kind === "FORMAL") {
      await this.assertFormalRedeemCooldown(tx, userId, now);
    }

    const currentGrant = await tx.entitlementGrant.findUnique({
      where: { userId },
      select: {
        tier: true,
        startsAt: true,
        endsAt: true
      }
    });

    const nextGrant =
      membershipCode.batch.sku.kind === "TRIAL"
        ? await this.buildTrialGrant(tx, userId, currentGrant, membershipCode.batch.sku.durationDays, now)
        : this.buildFormalGrant(currentGrant, membershipCode.batch.sku.tier, membershipCode.batch.sku.durationDays, now);

    const redeemed = await tx.membershipCode.updateMany({
      where: {
        id: membershipCode.id,
        status: "ACTIVE"
      },
      data: {
        status: "REDEEMED",
        redeemedByUserId: userId,
        redeemedAt: now
      }
    });

    if (redeemed.count !== 1) {
      throw new RedeemBusinessError(INVALID_REDEEM_CODE, INVALID_REDEEM_MESSAGE);
    }

    const entitlementGrant = await tx.entitlementGrant.upsert({
      where: { userId },
      create: {
        userId,
        tier: nextGrant.tier,
        startsAt: nextGrant.startsAt,
        endsAt: nextGrant.endsAt
      },
      update: {
        tier: nextGrant.tier,
        startsAt: nextGrant.startsAt,
        endsAt: nextGrant.endsAt
      }
    });

    await tx.auditEvent.create({
      data: {
        actorType: "USER",
        actorUserId: userId,
        action: "membership-code.redeem",
        objectType: "membership_code",
        objectId: membershipCode.id,
        payload: {
          batchId: membershipCode.batchId,
          codeMask: membershipCode.codeMask,
          skuCode: membershipCode.batch.sku.code,
          kind: membershipCode.batch.sku.kind,
          tier: entitlementGrant.tier,
          validUntil: entitlementGrant.endsAt?.toISOString() ?? null
        }
      }
    });

    return {
      membership: toMembership(entitlementGrant.tier, entitlementGrant.endsAt),
      redeemedAt: now.toISOString()
    };
  }

  private async assertFormalRedeemCooldown(tx: Prisma.TransactionClient, userId: UUID, now: Date) {
    const lastFormalRedeem = await tx.membershipCode.findFirst({
      where: {
        redeemedByUserId: userId,
        status: "REDEEMED",
        batch: {
          sku: {
            kind: "FORMAL"
          }
        }
      },
      orderBy: {
        redeemedAt: "desc"
      },
      select: {
        redeemedAt: true
      }
    });

    if (!lastFormalRedeem?.redeemedAt) return;

    if (addDays(lastFormalRedeem.redeemedAt, FORMAL_REDEEM_COOLDOWN_DAYS) > now) {
      throw new RedeemBusinessError(REDEEM_COOLDOWN_CODE, REDEEM_COOLDOWN_MESSAGE);
    }
  }

  private async buildTrialGrant(
    tx: Prisma.TransactionClient,
    userId: UUID,
    currentGrant: Pick<EntitlementGrant, "tier" | "startsAt" | "endsAt"> | null,
    durationDays: number,
    now: Date
  ): Promise<GrantPlan> {
    if (isGrantActive(currentGrant, now)) {
      throw new RedeemBusinessError(INVALID_REDEEM_CODE, INVALID_REDEEM_MESSAGE);
    }

    const redeemedTrials = await tx.membershipCode.findMany({
      where: {
        redeemedByUserId: userId,
        status: "REDEEMED",
        batch: {
          sku: {
            kind: "TRIAL"
          }
        }
      },
      select: {
        batch: {
          select: {
            sku: {
              select: {
                durationDays: true
              }
            }
          }
        }
      }
    });

    const usedTrialDays = redeemedTrials.reduce<number>((total, item) => total + item.batch.sku.durationDays, 0);
    if (usedTrialDays + durationDays > TRIAL_DAY_LIMIT) {
      throw new RedeemBusinessError(INVALID_REDEEM_CODE, INVALID_REDEEM_MESSAGE);
    }

    return {
      tier: "PRO",
      startsAt: now,
      endsAt: addDays(now, durationDays)
    };
  }

  private buildFormalGrant(
    currentGrant: Pick<EntitlementGrant, "tier" | "startsAt" | "endsAt"> | null,
    redeemTier: EntitlementTier,
    durationDays: number,
    now: Date
  ): GrantPlan {
    const active = isGrantActive(currentGrant, now) ? currentGrant : null;

    if (!active) {
      return {
        tier: redeemTier,
        startsAt: now,
        endsAt: addDays(now, durationDays)
      };
    }

    if (active.tier === "ULTRA" || active.endsAt === null) {
      throw new RedeemBusinessError(INVALID_REDEEM_CODE, INVALID_REDEEM_MESSAGE);
    }

    if (active.tier === redeemTier) {
      return {
        tier: redeemTier,
        startsAt: active.startsAt,
        endsAt: addDays(active.endsAt, durationDays)
      };
    }

    if (active.tier === "PLUS" && redeemTier === "PRO") {
      return {
        tier: "PRO",
        startsAt: now,
        endsAt: addDays(active.endsAt, durationDays)
      };
    }

    throw new RedeemBusinessError(INVALID_REDEEM_CODE, INVALID_REDEEM_MESSAGE);
  }
}
