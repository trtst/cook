import { randomBytes } from "node:crypto";
import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { type MembershipCodeBatch, type MembershipCodeStatus, type MembershipSku, type Prisma } from "@prisma/client";
import { completeAdminIdempotentOperation, getAdminIdempotentResult, startAdminIdempotentOperation } from "../../common/idempotency";
import { PrismaService } from "../../common/prisma.service";
import type {
  AdminMembershipCodeGenerationItem,
  AdminGenerateMembershipCodesResult,
  AdminMembershipCodeBatchItem,
  AdminMembershipCodeItem,
  AdminMembershipSkuItem,
  AdminMembershipSkuListResponse,
  CreateAdminMembershipCodeBatchRequest,
  GenerateAdminMembershipCodesRequest,
  PageResult,
  SetAdminMembershipSkuStatusRequest,
  SetAdminMembershipCodeBatchStatusRequest,
  UUID
} from "../../contracts/types";
import {
  ensureMembershipSkuCatalog,
  getMembershipSkuPreset,
  isAllowedMembershipSkuPreset,
  membershipSkuPresetCodes
} from "../user/membership-code.catalog";
import { hashCode, maskCode, normalizeCode } from "../user/membership-code.utils";

const batchWindowStates = ["NO_LIMIT", "PENDING", "ACTIVE", "EXPIRED"] as const;
const codeCharset = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const codeSegmentLength = 4;
const codeSegmentCount = 4;
const maxGenerateCount = 1000;

type Tx = Prisma.TransactionClient | PrismaService;
type MembershipBatchRow = MembershipCodeBatch & {
  sku: MembershipSku;
};
type MembershipCodeRow = Prisma.MembershipCodeGetPayload<{
  include: {
    batch: {
      include: {
        sku: true;
      };
    };
    redeemedBy: {
      select: {
        id: true;
        uid: true;
        nickname: true;
      };
    };
  };
}>;
type AuditEventRow = Prisma.AuditEventGetPayload<{
  include: {
    actorAdmin: {
      select: {
        id: true;
        username: true;
        displayName: true;
      };
    };
  };
}>;

type BatchCountMap = Map<number, { codeCount: number; activeCodeCount: number; redeemedCodeCount: number; disabledCodeCount: number }>;

function toIsoDate(value: Date) {
  return value.toISOString();
}

function toPositiveInt(value: number | undefined, fallback: number) {
  if (!Number.isFinite(value) || !value || value < 1) return fallback;
  return Math.floor(value);
}

function sortSkuItems(items: AdminMembershipSkuItem[]) {
  const order = new Map<string, number>(membershipSkuPresetCodes.map((code, index) => [code, index]));
  return items.sort((left, right) => (order.get(left.code) ?? 999) - (order.get(right.code) ?? 999));
}

function toWindowState(startsAt: Date | null, endsAt: Date | null, now: Date): (typeof batchWindowStates)[number] {
  if (!startsAt && !endsAt) return "NO_LIMIT";
  if (startsAt && startsAt > now) return "PENDING";
  if (endsAt && endsAt <= now) return "EXPIRED";
  return "ACTIVE";
}

function toSkuItem(row: MembershipSku): AdminMembershipSkuItem {
  return {
    id: row.id,
    code: row.code,
    kind: row.kind,
    tier: row.tier,
    durationDays: row.durationDays,
    redeemEnabled: row.redeemEnabled,
    version: row.version,
    createdAt: toIsoDate(row.createdAt),
    updatedAt: toIsoDate(row.updatedAt)
  };
}

function toOperatorSummary(row: MembershipCodeRow["redeemedBy"]) {
  if (!row) return null;
  return {
    id: row.id,
    uid: row.uid,
    nickname: row.nickname
  };
}

function toCodeItem(row: MembershipCodeRow): AdminMembershipCodeItem {
  return {
    id: row.id,
    batchId: row.batchId,
    batchName: row.batch.name,
    skuCode: row.batch.sku.code,
    kind: row.batch.sku.kind,
    tier: row.batch.sku.tier,
    durationDays: row.batch.sku.durationDays,
    codeMask: row.codeMask,
    status: row.status,
    redeemedBy: toOperatorSummary(row.redeemedBy),
    redeemedAt: row.redeemedAt ? toIsoDate(row.redeemedAt) : null,
    createdAt: toIsoDate(row.createdAt),
    updatedAt: toIsoDate(row.updatedAt)
  };
}

function toGenerationItem(
  row: AuditEventRow,
  batchMap: Map<number, { id: number; name: string; skuCode: string }>
): AdminMembershipCodeGenerationItem {
  const batch = row.objectId ? batchMap.get(row.objectId) : null;
  const payload = typeof row.payload === "object" && row.payload !== null ? (row.payload as Record<string, unknown>) : {};
  const generatedCount = typeof payload.generatedCount === "number" ? payload.generatedCount : 0;
  const skuCode = batch?.skuCode ?? (typeof payload.skuCode === "string" ? payload.skuCode : "");
  return {
    id: row.id,
    batchId: batch?.id ?? 0,
    batchName: batch?.name ?? `批次 #${row.objectId ?? 0}`,
    skuCode,
    generatedCount,
    generatedBy: row.actorAdmin
      ? {
          id: row.actorAdmin.id,
          username: row.actorAdmin.username,
          displayName: row.actorAdmin.displayName
        }
      : null,
    exportedAt: toIsoDate(row.createdAt),
    createdAt: toIsoDate(row.createdAt)
  };
}

function createCodeCounts(ids: number[], rows: Array<{ batchId: number; status: MembershipCodeStatus; _count: { _all: number } }>): BatchCountMap {
  const map = new Map<number, { codeCount: number; activeCodeCount: number; redeemedCodeCount: number; disabledCodeCount: number }>();
  for (const id of ids) {
    map.set(id, {
      codeCount: 0,
      activeCodeCount: 0,
      redeemedCodeCount: 0,
      disabledCodeCount: 0
    });
  }

  for (const row of rows) {
    const target = map.get(row.batchId);
    if (!target) continue;
    target.codeCount += row._count._all;
    if (row.status === "ACTIVE") target.activeCodeCount += row._count._all;
    if (row.status === "REDEEMED") target.redeemedCodeCount += row._count._all;
    if (row.status === "DISABLED") target.disabledCodeCount += row._count._all;
  }

  return map;
}

function toBatchItem(row: MembershipBatchRow, counts: BatchCountMap, now: Date): AdminMembershipCodeBatchItem {
  const summary = counts.get(row.id) ?? {
    codeCount: 0,
    activeCodeCount: 0,
    redeemedCodeCount: 0,
    disabledCodeCount: 0
  };
  return {
    id: row.id,
    sku: toSkuItem(row.sku),
    name: row.name,
    redeemEnabled: row.redeemEnabled,
    startsAt: row.startsAt ? toIsoDate(row.startsAt) : null,
    endsAt: row.endsAt ? toIsoDate(row.endsAt) : null,
    windowState: toWindowState(row.startsAt, row.endsAt, now),
    version: row.version,
    codeCount: summary.codeCount,
    activeCodeCount: summary.activeCodeCount,
    redeemedCodeCount: summary.redeemedCodeCount,
    disabledCodeCount: summary.disabledCodeCount,
    createdAt: toIsoDate(row.createdAt),
    updatedAt: toIsoDate(row.updatedAt)
  };
}

function buildExactCode(length = codeSegmentLength * codeSegmentCount) {
  let value = "";
  while (value.length < length) {
    const bytes = randomBytes(length);
    for (const byte of bytes) {
      value += codeCharset[byte % codeCharset.length];
      if (value.length >= length) break;
    }
  }

  const parts: string[] = [];
  for (let index = 0; index < value.length; index += codeSegmentLength) {
    parts.push(value.slice(index, index + codeSegmentLength));
  }
  return parts.join("-");
}

@Injectable()
export class AdminMembershipCodeService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listSkus(): Promise<AdminMembershipSkuListResponse> {
    await ensureMembershipSkuCatalog(this.prisma);
    const rows = await this.prisma.membershipSku.findMany({
      where: { code: { in: membershipSkuPresetCodes } }
    });

    return {
      items: sortSkuItems(rows.map(item => toSkuItem(item))),
      syncedAt: new Date().toISOString()
    };
  }

  async setSkuStatus(adminId: UUID, skuId: UUID, operationId: string, body: SetAdminMembershipSkuStatusRequest): Promise<AdminMembershipSkuItem> {
    const requestHash = JSON.stringify({ skuId, ...body });

    return this.prisma.$transaction(async tx => {
      const repeated = await getAdminIdempotentResult<AdminMembershipSkuItem>(
        tx,
        operationId,
        "admin-membership-sku:set-status",
        adminId,
        requestHash
      );
      if (repeated) return repeated;

      await startAdminIdempotentOperation(tx, operationId, "admin-membership-sku:set-status", adminId, requestHash);
      await ensureMembershipSkuCatalog(tx);

      const current = await tx.membershipSku.findUnique({
        where: { id: skuId }
      });
      if (!current || !isAllowedMembershipSkuPreset(current)) {
        throw new NotFoundException("会员 SKU 不存在");
      }
      if (current.version !== body.expectedVersion) {
        throw new ConflictException("会员 SKU 已更新，请刷新后重试");
      }

      const updated =
        current.redeemEnabled === body.redeemEnabled
          ? current
          : await tx.membershipSku.update({
              where: { id: skuId },
              data: {
                redeemEnabled: body.redeemEnabled,
                version: { increment: 1 }
              }
            });

      await tx.auditEvent.create({
        data: {
          actorType: "ADMIN",
          actorAdminId: adminId,
          action: "membership-sku.set-status",
          objectType: "membership_sku",
          objectId: updated.id,
          payload: {
            code: updated.code,
            redeemEnabled: updated.redeemEnabled,
            version: updated.version
          }
        }
      });

      const result = toSkuItem(updated);
      await completeAdminIdempotentOperation(tx, operationId, "admin-membership-sku:set-status", adminId, requestHash, result);
      return result;
    });
  }

  async listBatches(
    page: number,
    pageSize: number,
    keyword?: string,
    skuCode?: string,
    redeemEnabled?: boolean
  ): Promise<PageResult<AdminMembershipCodeBatchItem>> {
    await ensureMembershipSkuCatalog(this.prisma);
    const normalizedPage = toPositiveInt(page, 1);
    const normalizedPageSize = Math.min(100, toPositiveInt(pageSize, 20));
    const skip = (normalizedPage - 1) * normalizedPageSize;
    const trimmedKeyword = keyword?.trim();
    const where: Prisma.MembershipCodeBatchWhereInput = {
      ...(trimmedKeyword
        ? {
            OR: [
              { name: { contains: trimmedKeyword, mode: "insensitive" } },
              { sku: { code: { contains: trimmedKeyword, mode: "insensitive" } } }
            ]
          }
        : {}),
      ...(skuCode ? { sku: { code: skuCode } } : {}),
      ...(redeemEnabled === undefined ? {} : { redeemEnabled })
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.membershipCodeBatch.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: normalizedPageSize,
        include: { sku: true }
      }),
      this.prisma.membershipCodeBatch.count({ where })
    ]);

    const counts = await this.loadBatchCounts(this.prisma, items.map(item => item.id));
    const now = new Date();
    return {
      items: items.map(item => toBatchItem(item, counts, now)),
      page: normalizedPage,
      pageSize: normalizedPageSize,
      total,
      hasNext: skip + items.length < total
    };
  }

  async createBatch(adminId: UUID, operationId: string, body: CreateAdminMembershipCodeBatchRequest): Promise<AdminMembershipCodeBatchItem> {
    const requestHash = JSON.stringify(body);

    return this.prisma.$transaction(async tx => {
      const repeated = await getAdminIdempotentResult<AdminMembershipCodeBatchItem>(
        tx,
        operationId,
        "admin-membership-code-batch:create",
        adminId,
        requestHash
      );
      if (repeated) return repeated;

      await startAdminIdempotentOperation(tx, operationId, "admin-membership-code-batch:create", adminId, requestHash);
      await ensureMembershipSkuCatalog(tx);

      const skuPreset = getMembershipSkuPreset(body.skuCode);
      if (!skuPreset) {
        throw new BadRequestException("会员 SKU 不在固定目录内");
      }

      const startsAt = body.startsAt ? new Date(body.startsAt) : null;
      const endsAt = body.endsAt ? new Date(body.endsAt) : null;
      if (startsAt && Number.isNaN(startsAt.getTime())) throw new BadRequestException("开始时间无效");
      if (endsAt && Number.isNaN(endsAt.getTime())) throw new BadRequestException("结束时间无效");
      if (startsAt && endsAt && startsAt >= endsAt) {
        throw new BadRequestException("结束时间必须晚于开始时间");
      }

      const sku = await tx.membershipSku.findUnique({
        where: { code: body.skuCode }
      });
      if (!sku || !isAllowedMembershipSkuPreset(sku)) {
        throw new BadRequestException("会员 SKU 未初始化成功，请刷新后重试");
      }

      const created = await tx.membershipCodeBatch.create({
        data: {
          skuId: sku.id,
          name: body.name.trim(),
          redeemEnabled: body.redeemEnabled,
          startsAt,
          endsAt
        },
        include: { sku: true }
      });

      await tx.auditEvent.create({
        data: {
          actorType: "ADMIN",
          actorAdminId: adminId,
          action: "membership-code-batch.create",
          objectType: "membership_code_batch",
          objectId: created.id,
          payload: {
            skuCode: created.sku.code,
            name: created.name,
            redeemEnabled: created.redeemEnabled,
            startsAt: created.startsAt?.toISOString() ?? null,
            endsAt: created.endsAt?.toISOString() ?? null
          }
        }
      });

      const counts = await this.loadBatchCounts(tx, [created.id]);
      const result = toBatchItem(created, counts, new Date());
      await completeAdminIdempotentOperation(tx, operationId, "admin-membership-code-batch:create", adminId, requestHash, result);
      return result;
    });
  }

  async setBatchStatus(
    adminId: UUID,
    batchId: UUID,
    operationId: string,
    body: SetAdminMembershipCodeBatchStatusRequest
  ): Promise<AdminMembershipCodeBatchItem> {
    const requestHash = JSON.stringify({ batchId, ...body });
    return this.prisma.$transaction(async tx => {
      const repeated = await getAdminIdempotentResult<AdminMembershipCodeBatchItem>(
        tx,
        operationId,
        "admin-membership-code-batch:set-status",
        adminId,
        requestHash
      );
      if (repeated) return repeated;

      await startAdminIdempotentOperation(tx, operationId, "admin-membership-code-batch:set-status", adminId, requestHash);
      const current = await tx.membershipCodeBatch.findUnique({
        where: { id: batchId },
        include: { sku: true }
      });
      if (!current) throw new NotFoundException("兑换码批次不存在");
      if (current.version !== body.expectedVersion) {
        throw new ConflictException("兑换码批次已更新，请刷新后重试");
      }
      if (!isAllowedMembershipSkuPreset(current.sku)) {
        throw new BadRequestException("兑换码批次的 SKU 不在固定目录内");
      }

      const updated =
        current.redeemEnabled === body.redeemEnabled
          ? current
          : await tx.membershipCodeBatch.update({
              where: { id: batchId },
              data: {
                redeemEnabled: body.redeemEnabled,
                version: { increment: 1 }
              },
              include: { sku: true }
            });

      await tx.auditEvent.create({
        data: {
          actorType: "ADMIN",
          actorAdminId: adminId,
          action: "membership-code-batch.set-status",
          objectType: "membership_code_batch",
          objectId: updated.id,
          payload: {
            redeemEnabled: updated.redeemEnabled,
            version: updated.version
          }
        }
      });

      const counts = await this.loadBatchCounts(tx, [updated.id]);
      const result = toBatchItem(updated, counts, new Date());
      await completeAdminIdempotentOperation(tx, operationId, "admin-membership-code-batch:set-status", adminId, requestHash, result);
      return result;
    });
  }

  async generateCodes(
    adminId: UUID,
    batchId: UUID,
    operationId: string,
    body: GenerateAdminMembershipCodesRequest
  ): Promise<AdminGenerateMembershipCodesResult> {
    const requestHash = JSON.stringify({ batchId, quantity: body.quantity });
    return this.prisma.$transaction(async tx => {
      const repeated = await getAdminIdempotentResult<AdminGenerateMembershipCodesResult>(
        tx,
        operationId,
        "admin-membership-code:generate",
        adminId,
        requestHash
      );
      if (repeated) {
        throw new ConflictException("兑换码已生成，明文仅在首次生成响应中返回，请重新生成一批兑换码");
      }

      await startAdminIdempotentOperation(tx, operationId, "admin-membership-code:generate", adminId, requestHash);
      const batch = await tx.membershipCodeBatch.findUnique({
        where: { id: batchId },
        include: { sku: true }
      });
      if (!batch) throw new NotFoundException("兑换码批次不存在");
      if (!isAllowedMembershipSkuPreset(batch.sku)) {
        throw new BadRequestException("兑换码批次的 SKU 不在固定目录内");
      }

      const quantity = body.quantity;
      if (quantity < 1 || quantity > maxGenerateCount) {
        throw new BadRequestException(`单次最多生成 ${maxGenerateCount} 个兑换码`);
      }

      const generatedCodes = await this.createUniqueCodes(tx, quantity);
      const now = new Date();
      await tx.membershipCode.createMany({
        data: generatedCodes.map(item => ({
          batchId,
          codeHash: hashCode(item.code),
          codeMask: item.codeMask,
          status: "ACTIVE",
          createdAt: now,
          updatedAt: now
        }))
      });

      await tx.auditEvent.create({
        data: {
          actorType: "ADMIN",
          actorAdminId: adminId,
          action: "membership-code.generate",
          objectType: "membership_code_batch",
          objectId: batchId,
          payload: {
            skuCode: batch.sku.code,
            generatedCount: quantity,
            masks: generatedCodes.slice(0, 10).map(item => item.codeMask)
          }
        }
      });

      const counts = await this.loadBatchCounts(tx, [batch.id]);
      const result = {
        batch: toBatchItem(batch, counts, now),
        generatedCount: quantity,
        exportedAt: now.toISOString(),
        codes: generatedCodes
      } satisfies AdminGenerateMembershipCodesResult;
      await completeAdminIdempotentOperation(
        tx,
        operationId,
        "admin-membership-code:generate",
        adminId,
        requestHash,
        result,
        {
          ...result,
          codes: []
        }
      );
      return result;
    });
  }

  async listCodes(
    page: number,
    pageSize: number,
    batchId?: number,
    status?: string,
    code?: string
  ): Promise<PageResult<AdminMembershipCodeItem>> {
    return this.listCodePage(page, pageSize, {
      ...(batchId ? { batchId } : {}),
      ...(status ? { status: status as MembershipCodeStatus } : {}),
      ...this.buildCodeWhere(code)
    });
  }

  async listGenerations(
    page: number,
    pageSize: number,
    batchId?: number,
    skuCode?: string
  ): Promise<PageResult<AdminMembershipCodeGenerationItem>> {
    const normalizedPage = toPositiveInt(page, 1);
    const normalizedPageSize = Math.min(100, toPositiveInt(pageSize, 20));
    const skip = (normalizedPage - 1) * normalizedPageSize;
    const batchFilter = await this.resolveGenerationBatchFilter(batchId, skuCode);
    if (batchFilter === null) {
      return {
        items: [],
        page: normalizedPage,
        pageSize: normalizedPageSize,
        total: 0,
        hasNext: false
      };
    }

    const where: Prisma.AuditEventWhereInput = {
      actorType: "ADMIN",
      action: "membership-code.generate",
      objectType: "membership_code_batch",
      ...(batchFilter === undefined ? {} : { objectId: batchFilter })
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.auditEvent.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip,
        take: normalizedPageSize,
        include: {
          actorAdmin: {
            select: {
              id: true,
              username: true,
              displayName: true
            }
          }
        }
      }),
      this.prisma.auditEvent.count({ where })
    ]);

    const batchIds = items
      .map(item => item.objectId)
      .filter((value): value is number => typeof value === "number");
    const batches = batchIds.length
      ? await this.prisma.membershipCodeBatch.findMany({
          where: { id: { in: batchIds } },
          include: {
            sku: {
              select: {
                code: true
              }
            }
          }
        })
      : [];
    const batchMap = new Map(batches.map(item => [item.id, { id: item.id, name: item.name, skuCode: item.sku.code }] as const));

    return {
      items: items.map(item => toGenerationItem(item, batchMap)),
      page: normalizedPage,
      pageSize: normalizedPageSize,
      total,
      hasNext: skip + items.length < total
    };
  }

  async listRedemptions(
    page: number,
    pageSize: number,
    options: {
      batchId?: number;
      skuCode?: string;
      uid?: number;
      redeemedFrom?: string;
      redeemedTo?: string;
      code?: string;
    }
  ): Promise<PageResult<AdminMembershipCodeItem>> {
    const redeemedAt =
      options.redeemedFrom || options.redeemedTo
        ? {
            ...(options.redeemedFrom ? { gte: new Date(options.redeemedFrom) } : {}),
            ...(options.redeemedTo ? { lte: new Date(options.redeemedTo) } : {})
          }
        : undefined;

    return this.listCodePage(page, pageSize, {
      status: "REDEEMED",
      ...(options.batchId ? { batchId: options.batchId } : {}),
      ...(options.skuCode
        ? {
            batch: {
              sku: {
                code: options.skuCode
              }
            }
          }
        : {}),
      ...(options.uid
        ? {
            redeemedBy: {
              is: {
                uid: options.uid
              }
            }
          }
        : {}),
      ...(redeemedAt ? { redeemedAt } : {}),
      ...this.buildCodeWhere(options.code)
    });
  }

  async disableCode(adminId: UUID, codeId: UUID, operationId: string): Promise<AdminMembershipCodeItem> {
    const requestHash = JSON.stringify({ codeId });

    return this.prisma.$transaction(async tx => {
      const repeated = await getAdminIdempotentResult<AdminMembershipCodeItem>(
        tx,
        operationId,
        "admin-membership-code:disable",
        adminId,
        requestHash
      );
      if (repeated) return repeated;

      await startAdminIdempotentOperation(tx, operationId, "admin-membership-code:disable", adminId, requestHash);
      const current = await tx.membershipCode.findUnique({
        where: { id: codeId },
        include: {
          batch: {
            include: {
              sku: true
            }
          },
          redeemedBy: {
            select: {
              id: true,
              uid: true,
              nickname: true
            }
          }
        }
      });
      if (!current) throw new NotFoundException("兑换码不存在");
      if (current.status === "REDEEMED") {
        throw new BadRequestException("已使用兑换码不能停用");
      }

      if (current.status === "ACTIVE") {
        const updated = await tx.membershipCode.updateMany({
          where: {
            id: codeId,
            status: "ACTIVE"
          },
          data: {
            status: "DISABLED"
          }
        });
        if (updated.count !== 1) {
          throw new ConflictException("兑换码状态已变化，请刷新后重试");
        }
      }

      const resultRow = await tx.membershipCode.findUniqueOrThrow({
        where: { id: codeId },
        include: {
          batch: {
            include: {
              sku: true
            }
          },
          redeemedBy: {
            select: {
              id: true,
              uid: true,
              nickname: true
            }
          }
        }
      });

      await tx.auditEvent.create({
        data: {
          actorType: "ADMIN",
          actorAdminId: adminId,
          action: "membership-code.disable",
          objectType: "membership_code",
          objectId: codeId,
          payload: {
            batchId: resultRow.batchId,
            codeMask: resultRow.codeMask
          }
        }
      });

      const result = toCodeItem(resultRow);
      await completeAdminIdempotentOperation(tx, operationId, "admin-membership-code:disable", adminId, requestHash, result);
      return result;
    });
  }

  private async loadBatchCounts(tx: Tx, batchIds: number[]): Promise<BatchCountMap> {
    if (batchIds.length === 0) return new Map();
    const rows = await tx.membershipCode.groupBy({
      by: ["batchId", "status"],
      where: { batchId: { in: batchIds } },
      _count: { _all: true }
    });
    return createCodeCounts(batchIds, rows);
  }

  private async resolveGenerationBatchFilter(batchId?: number, skuCode?: string) {
    if (!batchId && !skuCode) return undefined;
    if (batchId && !skuCode) return batchId;

    const matchedBatches = await this.prisma.membershipCodeBatch.findMany({
      where: {
        ...(batchId ? { id: batchId } : {}),
        ...(skuCode
          ? {
              sku: {
                code: skuCode
              }
            }
          : {})
      },
      select: { id: true }
    });
    if (matchedBatches.length === 0) return null;
    if (matchedBatches.length === 1) return matchedBatches[0].id;
    return { in: matchedBatches.map(item => item.id) } satisfies Prisma.IntFilter;
  }

  private buildCodeWhere(code?: string): Prisma.MembershipCodeWhereInput {
    const trimmedCode = code?.trim();
    if (!trimmedCode) return {};

    const normalizedCode = normalizeCode(trimmedCode);
    const exactCodeHash = normalizedCode && /^[A-Z0-9]{6,40}$/.test(normalizedCode) ? hashCode(normalizedCode) : "";
    return {
      OR: [
        ...(exactCodeHash ? [{ codeHash: exactCodeHash }] : []),
        { codeMask: { contains: trimmedCode.toUpperCase(), mode: "insensitive" } }
      ]
    };
  }

  private async listCodePage(
    page: number,
    pageSize: number,
    where: Prisma.MembershipCodeWhereInput
  ): Promise<PageResult<AdminMembershipCodeItem>> {
    const normalizedPage = toPositiveInt(page, 1);
    const normalizedPageSize = Math.min(100, toPositiveInt(pageSize, 20));
    const skip = (normalizedPage - 1) * normalizedPageSize;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.membershipCode.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip,
        take: normalizedPageSize,
        include: {
          batch: {
            include: {
              sku: true
            }
          },
          redeemedBy: {
            select: {
              id: true,
              uid: true,
              nickname: true
            }
          }
        }
      }),
      this.prisma.membershipCode.count({ where })
    ]);

    return {
      items: items.map(item => toCodeItem(item)),
      page: normalizedPage,
      pageSize: normalizedPageSize,
      total,
      hasNext: skip + items.length < total
    };
  }

  private async createUniqueCodes(tx: Prisma.TransactionClient, quantity: number) {
    const items: Array<{ code: string; codeMask: string }> = [];
    const seenHashes = new Set<string>();

    while (items.length < quantity) {
      const chunkSize = Math.max((quantity - items.length) * 2, 8);
      const candidates: Array<{ code: string; codeMask: string; codeHash: string }> = [];
      for (let index = 0; index < chunkSize; index += 1) {
        const code = buildExactCode();
        const codeHash = hashCode(code);
        if (seenHashes.has(codeHash)) continue;
        seenHashes.add(codeHash);
        candidates.push({
          code,
          codeMask: maskCode(code),
          codeHash
        });
      }

      const exists = candidates.length
        ? await tx.membershipCode.findMany({
            where: {
              codeHash: {
                in: candidates.map(item => item.codeHash)
              }
            },
            select: { codeHash: true }
          })
        : [];
      const existingHashes = new Set(exists.map(item => item.codeHash));

      for (const candidate of candidates) {
        if (existingHashes.has(candidate.codeHash)) continue;
        items.push({
          code: candidate.code,
          codeMask: candidate.codeMask
        });
        if (items.length >= quantity) break;
      }
    }

    return items;
  }
}
