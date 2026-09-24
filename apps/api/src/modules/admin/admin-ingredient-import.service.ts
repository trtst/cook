import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { createHash } from "node:crypto";
import type {
  AdminDeleteIngredientImportJobResult,
  AdminDeleteIngredientImportItemResult,
  IngredientImportBody,
  IngredientImportItemDetail,
  IngredientImportItemSummary,
  IngredientImportJobDetail,
  IngredientImportJobSummary,
  IngredientImportMatchSummary,
  IngredientImportNutritionBody,
  ImportIngredientImportItemRequest,
  DeleteIngredientImportItemRequest,
  PageResult,
  RecipeImportIssue,
  UUID,
  UpdateIngredientImportItemRequest
} from "../../contracts/types";
import { PrismaService } from "../../common/prisma.service";
import { completeAdminIdempotentOperation, getAdminIdempotentResult, startAdminIdempotentOperation } from "../../common/idempotency";
import { buildSearchKey } from "../recipe/recipe-content";
import { fromJson, toJson } from "../recipe/recipe-content";
import { parseIngredientImportSource, type IngredientImportItemDraft } from "./ingredient-import-json";
import { readJsonSourcesFromFiles } from "./recipe-import-json";

export interface IngredientMatchCandidate {
  id: number;
  name: string;
  aliases: string[];
  status: "PENDING" | "ACTIVE" | "DISABLED" | "MERGED";
  mergedToId: number | null;
  version: number;
}

export type IngredientMatchResult =
  | { kind: "MATCHED"; matchType: "EXACT_NAME" | "ALIAS"; ingredientId: number; ingredientName: string }
  | { kind: "CREATE" }
  | { kind: "AMBIGUOUS"; ingredientIds: number[] };

const statusPriority: Record<IngredientMatchCandidate["status"], number> = {
  ACTIVE: 4,
  MERGED: 3,
  PENDING: 2,
  DISABLED: 1
};

type IngredientCandidateMatch = {
  candidate: IngredientMatchCandidate;
  matchType: "EXACT_NAME" | "ALIAS";
};

export function buildIngredientImportRequestHash(sources: Array<{ sourcePath: string; jsonText: string }>) {
  const hash = createHash("sha256");
  for (const source of sources) {
    hash.update(source.sourcePath);
    hash.update("\0");
    hash.update(source.jsonText);
    hash.update("\0");
  }
  return hash.digest("hex");
}

function isUniqueConstraintError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export function matchIngredientImportItem(name: string, candidates: IngredientMatchCandidate[]): IngredientMatchResult {
  return resolveIngredientMatches(collectIngredientMatches(name, candidates), candidates);
}

function collectIngredientMatches(name: string, candidates: IngredientMatchCandidate[]): IngredientCandidateMatch[] {
  const searchKey = buildSearchKey(name);
  return candidates
    .flatMap(candidate => {
      const exact = buildSearchKey(candidate.name) === searchKey;
      const alias = candidate.aliases.some(item => buildSearchKey(item) === searchKey);
      if (!exact && !alias) return [];
      return [{ candidate, matchType: exact ? ("EXACT_NAME" as const) : ("ALIAS" as const) }];
    })
    .sort((left, right) => statusPriority[right.candidate.status] - statusPriority[left.candidate.status] || left.candidate.id - right.candidate.id);
}

function resolveIngredientMatches(matches: IngredientCandidateMatch[], candidates: IngredientMatchCandidate[]): IngredientMatchResult {
  if (matches.length === 0) return { kind: "CREATE" };
  const orderedMatches = [...matches].sort(
    (left, right) => statusPriority[right.candidate.status] - statusPriority[left.candidate.status] || left.candidate.id - right.candidate.id
  );

  const topPriority = statusPriority[orderedMatches[0]?.candidate.status ?? "DISABLED"];
  const topMatches = orderedMatches.filter(match => statusPriority[match.candidate.status] === topPriority);
  const activeIds = new Set<number>();
  for (const match of topMatches) {
    const resolvedId = match.candidate.status === "MERGED" ? match.candidate.mergedToId : match.candidate.id;
    if (resolvedId !== null) activeIds.add(resolvedId);
  }
  if (activeIds.size > 1) {
    return { kind: "AMBIGUOUS", ingredientIds: Array.from(activeIds).sort((a, b) => a - b) };
  }

  const selected = orderedMatches.find(match => match.candidate.status !== "MERGED" || match.candidate.mergedToId !== null) ?? orderedMatches[0];
  const ingredientId = selected.candidate.status === "MERGED" ? selected.candidate.mergedToId : selected.candidate.id;
  if (ingredientId === null) return { kind: "CREATE" };
  const target = candidates.find(candidate => candidate.id === ingredientId);
  return {
    kind: "MATCHED",
    matchType: selected.matchType,
    ingredientId,
    ingredientName: target?.name ?? selected.candidate.name
  };
}

@Injectable()
export class AdminIngredientImportService {
  constructor(private readonly prisma: PrismaService) {}

  async createImportJob(files: Array<{ originalname?: string; buffer?: Buffer; size?: number }>, adminId: UUID, operationId: string) {
    await this.requireSuperAdmin(adminId);
    if (files.length === 0) throw new BadRequestException("请至少上传一个 JSON 或 ZIP 文件");
    let sources: ReturnType<typeof readJsonSourcesFromFiles>;
    try {
      sources = readJsonSourcesFromFiles(files);
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : "导入文件格式不正确");
    }
    if (sources.length === 0) throw new BadRequestException("未找到可导入的 JSON 文件");
    const sourceName = files.map(file => file.originalname || "").filter(Boolean).join(", ");
    const requestHash = buildIngredientImportRequestHash(sources);
    const parsedSources = sources.map(source => {
      const parsed = parseIngredientImportSource(source);
      const rootErrors = parsed.errorItems.filter(issue => !issue.field || !issue.field.startsWith("ingredients."));
      return { source, parsed, rootErrors };
    });

    return this.prisma.$transaction(async tx => {
      const result = await getAdminIdempotentResult<IngredientImportJobSummary>(tx, operationId, "admin-ingredient-import:create", adminId, requestHash);
      if (result) return result;
      const existing = await tx.idempotencyRecord.findFirst({
        where: { operationId, operationType: "admin-ingredient-import:create", adminId },
        orderBy: { createdAt: "asc" }
      });
      if (existing?.status === "PROCESSING") throw new ConflictException("导入任务创建中，请稍后刷新");
      if (existing?.status === "FAILED") {
        await tx.idempotencyRecord.deleteMany({
          where: { operationId, operationType: "admin-ingredient-import:create", adminId, status: "FAILED" }
        });
      }
      await startAdminIdempotentOperation(tx, operationId, "admin-ingredient-import:create", adminId, requestHash);
      const job = await tx.ingredientImportJob.create({ data: { sourceName, status: "RUNNING", createdByAdminId: adminId } });

      for (const { source, parsed, rootErrors } of parsedSources) {
        if (parsed.items.length === 0) {
          await tx.ingredientImportItem.create({
            data: {
              jobId: job.id,
              sourcePath: source.sourcePath,
              title: source.sourcePath,
              status: "FAILED",
              rawBodyJson: toJson({ sourcePath: source.sourcePath, jsonText: source.jsonText }),
              ingredientBodyJson: toJson(emptyIngredientBody()),
              errorJson: toJson(rootErrors.length ? rootErrors : parsed.errorItems),
              warnJson: toJson(parsed.warnItems)
            }
          });
          continue;
        }
        for (const item of parsed.items) {
          const itemErrors = [...item.errorItems, ...rootErrors];
          const body = draftToBody(item);
          await tx.ingredientImportItem.create({
            data: {
              jobId: job.id,
              sourcePath: `${source.sourcePath}#ingredients[${item.sourceIndex}]`,
              title: body.name || source.sourcePath,
              status: itemErrors.length ? "NEEDS_FIX" : "READY",
              rawBodyJson: toJson({ sourcePath: source.sourcePath, jsonText: source.jsonText }),
              ingredientBodyJson: toJson(body),
              errorJson: toJson(itemErrors),
              warnJson: toJson(item.warnItems)
            }
          });
        }
      }
      await this.writeJobStats(tx, job.id);
      const completedJob = await tx.ingredientImportJob.findUnique({ where: { id: job.id } });
      if (!completedJob) throw new NotFoundException("食材导入任务不存在");
      const summary = toJobSummary(completedJob);
      await tx.auditEvent.create({
        data: {
          actorType: "ADMIN",
          actorAdminId: adminId,
          action: "INGREDIENT_IMPORT_JOB_CREATED",
          objectType: "INGREDIENT_IMPORT_JOB",
          objectId: job.id,
          payload: { sourceName, totalCount: completedJob.totalCount }
        }
      });
      await completeAdminIdempotentOperation(tx, operationId, "admin-ingredient-import:create", adminId, requestHash, summary);
      return summary;
    });
  }

  async listImportJobs(page: number, pageSize: number, status: string | undefined, adminId: UUID): Promise<PageResult<IngredientImportJobSummary>> {
    await this.requireSuperAdmin(adminId);
    const nextPage = positiveInt(page, 1);
    const nextPageSize = Math.min(100, positiveInt(pageSize, 20));
    const skip = (nextPage - 1) * nextPageSize;
    const where: Prisma.IngredientImportJobWhereInput = status ? { status: status as never } : {};
    const [items, total] = await this.prisma.$transaction([
      this.prisma.ingredientImportJob.findMany({ where, orderBy: [{ updatedAt: "desc" }, { id: "desc" }], skip, take: nextPageSize }),
      this.prisma.ingredientImportJob.count({ where })
    ]);
    return { items: items.map(toJobSummary), page: nextPage, pageSize: nextPageSize, total, hasNext: skip + items.length < total };
  }

  async getImportJobDetail(jobId: UUID, page: number, pageSize: number, status: string | undefined, adminId: UUID): Promise<IngredientImportJobDetail> {
    await this.requireSuperAdmin(adminId);
    const nextPage = positiveInt(page, 1);
    const nextPageSize = Math.min(100, positiveInt(pageSize, 20));
    const skip = (nextPage - 1) * nextPageSize;
    const job = await this.prisma.ingredientImportJob.findUnique({ where: { id: jobId } });
    if (!job) throw new NotFoundException("食材导入任务不存在");
    const where: Prisma.IngredientImportItemWhereInput = { jobId, ...(status ? { status: status as never } : {}) };
    const [items, total, categories] = await this.prisma.$transaction([
      this.prisma.ingredientImportItem.findMany({ where, orderBy: [{ updatedAt: "desc" }, { id: "desc" }], skip, take: nextPageSize }),
      this.prisma.ingredientImportItem.count({ where }),
      this.prisma.ingredientCategory.findMany({ select: { code: true, name: true } })
    ]);
    const categoryNames = new Map(categories.map(category => [category.code, category.name]));
    return { ...toJobSummary(job), items: { items: items.map(item => toIngredientImportItemSummary(item, categoryNames.get(fromJson<IngredientImportBody>(item.ingredientBodyJson).categoryCode ?? "") ?? null)), page: nextPage, pageSize: nextPageSize, total, hasNext: skip + items.length < total } };
  }

  async deleteImportJob(jobId: UUID, operationId: string, adminId: UUID): Promise<AdminDeleteIngredientImportJobResult> {
    await this.requireSuperAdmin(adminId);
    const requestHash = String(jobId);
    return this.prisma.$transaction(async tx => {
      const repeated = await getAdminIdempotentResult<AdminDeleteIngredientImportJobResult>(tx, operationId, "admin-ingredient-import:delete-job", adminId, requestHash);
      if (repeated) return repeated;
      await startAdminIdempotentOperation(tx, operationId, "admin-ingredient-import:delete-job", adminId, requestHash);
      const job = await tx.ingredientImportJob.findUnique({ where: { id: jobId }, select: { id: true, status: true } });
      if (!job) throw new NotFoundException("食材导入任务不存在");
      if (job.status === "RUNNING") throw new ConflictException("导入任务处理中，暂不能删除");
      await tx.ingredientImportJob.delete({ where: { id: jobId } });
      const result = { jobId, deletedAt: new Date().toISOString() };
      await completeAdminIdempotentOperation(tx, operationId, "admin-ingredient-import:delete-job", adminId, requestHash, result);
      return result;
    });
  }

  async getImportItemDetail(itemId: UUID, adminId: UUID): Promise<IngredientImportItemDetail> {
    await this.requireSuperAdmin(adminId);
    return this.prisma.$transaction(tx => this.readItemDetail(tx, itemId));
  }

  async updateImportItem(itemId: UUID, body: UpdateIngredientImportItemRequest, adminId: UUID): Promise<IngredientImportItemDetail> {
    await this.requireSuperAdmin(adminId);
    const requestHash = JSON.stringify({ itemId, expectedVersion: body.expectedVersion, ingredientBody: body.ingredientBody });
    return this.prisma.$transaction(async tx => {
      const repeated = await getAdminIdempotentResult<IngredientImportItemDetail>(tx, body.operationId, "admin-ingredient-import:update", adminId, requestHash);
      if (repeated) return repeated;
      await startAdminIdempotentOperation(tx, body.operationId, "admin-ingredient-import:update", adminId, requestHash);
      const current = await tx.ingredientImportItem.findUnique({ where: { id: itemId } });
      if (!current) throw new NotFoundException("食材导入条目不存在");
      if (current.version !== body.expectedVersion) throw new ConflictException("导入条目已被更新，请刷新后重试");
      const parsed = parseIngredientImportSource({ sourcePath: current.sourcePath, jsonText: JSON.stringify({ schemaVersion: "ingredient.import.v1", ingredients: [body.ingredientBody] }) });
      const next = parsed.items[0];
      if (!next) throw new BadRequestException("食材导入数据无效");
      const nextErrors = next.errorItems;
      const updated = await tx.ingredientImportItem.update({
        where: { id: itemId },
        data: {
          title: next.name || current.title,
          status: nextErrors.length ? "NEEDS_FIX" : "READY",
          ingredientBodyJson: toJson(draftToBody(next)),
          errorJson: toJson(nextErrors),
          warnJson: toJson(next.warnItems),
          ingredientId: null,
          matchType: null,
          version: { increment: 1 }
        }
      });
      const detail = await this.readItemDetail(tx, updated.id);
      await completeAdminIdempotentOperation(tx, body.operationId, "admin-ingredient-import:update", adminId, requestHash, detail);
      return detail;
    });
  }

  async importItem(itemId: UUID, body: ImportIngredientImportItemRequest, adminId: UUID): Promise<IngredientImportItemDetail> {
    await this.requireSuperAdmin(adminId);
    const requestHash = JSON.stringify({ itemId, expectedVersion: body.expectedVersion });
    return this.prisma.$transaction(async tx => {
      const repeated = await getAdminIdempotentResult<IngredientImportItemDetail>(tx, body.operationId, "admin-ingredient-import:import-item", adminId, requestHash);
      if (repeated) return repeated;
      await startAdminIdempotentOperation(tx, body.operationId, "admin-ingredient-import:import-item", adminId, requestHash);
      const current = await tx.ingredientImportItem.findUnique({ where: { id: itemId } });
      if (!current) throw new NotFoundException("食材导入条目不存在");
      if (current.version !== body.expectedVersion) throw new ConflictException("导入条目已被更新，请刷新后重试");
      if (current.status === "IMPORTED") {
        const detail = await this.readItemDetail(tx, itemId);
        await completeAdminIdempotentOperation(tx, body.operationId, "admin-ingredient-import:import-item", adminId, requestHash, detail);
        return detail;
      }
      if (current.status !== "READY") throw new ConflictException("请先修正导入条目中的错误");
      const ingredientBody = fromJson<IngredientImportBody>(current.ingredientBodyJson);
      const errors = fromJson<RecipeImportIssue[]>(current.errorJson);
      if (errors.length) throw new ConflictException("请先修正导入条目中的错误");

      const candidates = await this.loadCandidates(tx);
      const match = matchIngredientBody(ingredientBody, candidates);
      if (match.kind === "AMBIGUOUS") throw new ConflictException(`食材存在多个匹配项：${match.ingredientIds.join(",")}`);
      let ingredientId: number;
      let matchType: string;
      if (match.kind === "MATCHED") {
        ingredientId = match.ingredientId;
        matchType = match.matchType;
        const existing = await tx.ingredient.findUnique({ where: { id: ingredientId }, select: { id: true, name: true, aliases: true, status: true, mergedToId: true, version: true } });
        if (!existing) throw new ConflictException("匹配的食材已不存在，请重新导入");
        await this.appendAliases(tx, existing, ingredientBody.aliases, candidates);
        await this.writeNutritionIfMissing(tx, ingredientId, ingredientBody.nutrition);
      } else {
        const category = await tx.ingredientCategory.findFirst({ where: { code: ingredientBody.categoryCode ?? "", isSelectable: true }, select: { id: true } });
        if (!category) throw new BadRequestException("食材分类不存在或不可用");
        const defaultUnitId = ingredientBody.defaultUnitName ? await this.findSystemUnitId(tx, ingredientBody.defaultUnitName) : null;
        if (ingredientBody.defaultUnitName && !defaultUnitId) throw new BadRequestException(`系统单位不存在：${ingredientBody.defaultUnitName}`);
        let created: { id: number };
        try {
          created = await tx.ingredient.create({
            data: {
              ownerId: null,
              categoryId: category.id,
              defaultUnitId,
              name: ingredientBody.name,
              searchKey: buildSearchKey(ingredientBody.name),
              proteinType: ingredientBody.proteinType,
              isStaple: ingredientBody.isStaple,
              isSpicyIngredient: ingredientBody.isSpicyIngredient,
              aliases: ingredientBody.aliases,
              status: "PENDING"
            },
            select: { id: true }
          });
        } catch (error) {
          if (isUniqueConstraintError(error)) throw new ConflictException("食材已被其他管理员创建，请刷新后重试");
          throw error;
        }
        ingredientId = created.id;
        matchType = "CREATED_PENDING";
        await this.writeNutritionIfMissing(tx, ingredientId, ingredientBody.nutrition);
      }
      await tx.ingredientImportItem.update({ where: { id: itemId }, data: { ingredientId, matchType, status: "IMPORTED", version: { increment: 1 } } });
      await this.writeJobStats(tx, current.jobId);
      await tx.auditEvent.create({ data: { actorType: "ADMIN", actorAdminId: adminId, action: "INGREDIENT_IMPORT_ITEM_IMPORTED", objectType: "INGREDIENT_IMPORT_ITEM", objectId: itemId, payload: { ingredientId, matchType } } });
      const detail = await this.readItemDetail(tx, itemId);
      await completeAdminIdempotentOperation(tx, body.operationId, "admin-ingredient-import:import-item", adminId, requestHash, detail);
      return detail;
    });
  }

  async deleteImportItem(itemId: UUID, body: DeleteIngredientImportItemRequest, adminId: UUID): Promise<AdminDeleteIngredientImportItemResult> {
    await this.requireSuperAdmin(adminId);
    const requestHash = `${itemId}:${body.expectedVersion}`;
    return this.prisma.$transaction(async tx => {
      const repeated = await getAdminIdempotentResult<AdminDeleteIngredientImportItemResult>(tx, body.operationId, "admin-ingredient-import:delete-item", adminId, requestHash);
      if (repeated) return repeated;
      await startAdminIdempotentOperation(tx, body.operationId, "admin-ingredient-import:delete-item", adminId, requestHash);

      const current = await tx.ingredientImportItem.findUnique({ where: { id: itemId } });
      if (!current) throw new NotFoundException("食材导入条目不存在");
      if (current.version !== body.expectedVersion) throw new ConflictException("导入条目已被更新，请刷新后重试");

      let deletedIngredientId: number | null = null;
      if (current.status === "IMPORTED" && current.ingredientId !== null && current.matchType === "CREATED_PENDING") {
        const ingredient = await tx.ingredient.findUnique({ where: { id: current.ingredientId }, select: { id: true, ownerId: true, status: true } });
        const otherImportCount = await tx.ingredientImportItem.count({ where: { ingredientId: current.ingredientId, id: { not: itemId } } });
        if (ingredient && ingredient.ownerId === null && ingredient.status === "PENDING" && otherImportCount === 0 && !(await this.hasIngredientReference(tx, ingredient.id))) {
          deletedIngredientId = ingredient.id;
        }
      }

      await tx.ingredientImportItem.delete({ where: { id: itemId } });
      if (deletedIngredientId !== null) {
        await tx.ingredient.delete({ where: { id: deletedIngredientId } });
      }
      await this.writeJobStats(tx, current.jobId);
      const result: AdminDeleteIngredientImportItemResult = {
        itemId,
        jobId: current.jobId,
        deletedIngredientId,
        deletedAt: new Date().toISOString()
      };
      await tx.auditEvent.create({ data: { actorType: "ADMIN", actorAdminId: adminId, action: "INGREDIENT_IMPORT_ITEM_DELETED", objectType: "INGREDIENT_IMPORT_ITEM", objectId: itemId, payload: { jobId: current.jobId, deletedIngredientId } } });
      await completeAdminIdempotentOperation(tx, body.operationId, "admin-ingredient-import:delete-item", adminId, requestHash, result);
      return result;
    });
  }

  private async readItemDetail(tx: Prisma.TransactionClient, itemId: UUID): Promise<IngredientImportItemDetail> {
    const item = await tx.ingredientImportItem.findUnique({ where: { id: itemId } });
    if (!item) throw new NotFoundException("食材导入条目不存在");
    const body = fromJson<IngredientImportBody>(item.ingredientBodyJson);
    const match = await this.readMatch(tx, body);
    return {
      ...toIngredientImportItemSummary(item, null),
      rawBody: fromJson(item.rawBodyJson),
      ingredientBody: body,
      errorItems: fromJson(item.errorJson),
      warnItems: fromJson(item.warnJson),
      match
    };
  }

  private async readMatch(tx: Prisma.TransactionClient, body: IngredientImportBody): Promise<IngredientImportMatchSummary> {
    const candidates = await this.loadCandidates(tx);
    const match = matchIngredientBody(body, candidates);
    if (match.kind === "CREATE") return { kind: "CREATE", matchType: null, ingredientId: null, ingredientName: null, ingredientStatus: null, ingredientIds: [] };
    if (match.kind === "AMBIGUOUS") return { kind: "AMBIGUOUS", matchType: null, ingredientId: null, ingredientName: null, ingredientStatus: null, ingredientIds: match.ingredientIds };
    const ingredient = candidates.find(item => item.id === match.ingredientId);
    return { kind: "MATCHED", matchType: match.matchType, ingredientId: match.ingredientId, ingredientName: match.ingredientName, ingredientStatus: ingredient?.status ?? null, ingredientIds: [] };
  }

  private async loadCandidates(tx: Prisma.TransactionClient): Promise<IngredientMatchCandidate[]> {
    return tx.ingredient.findMany({ where: { ownerId: null }, select: { id: true, name: true, aliases: true, status: true, mergedToId: true, version: true } });
  }

  private async appendAliases(tx: Prisma.TransactionClient, ingredient: IngredientMatchCandidate, aliases: string[], candidates: IngredientMatchCandidate[]) {
    if (ingredient.status === "DISABLED") return;
    const nextAliases = Array.from(new Set([...ingredient.aliases, ...aliases].filter(alias => buildSearchKey(alias) !== buildSearchKey(ingredient.name))));
    if (nextAliases.length === ingredient.aliases.length) return;
    const conflicts = candidates.some(candidate => {
      if (candidate.id === ingredient.id || isMergedInto(candidate, ingredient.id, candidates)) return false;
      return [candidate.name, ...candidate.aliases].some(value => nextAliases.some(alias => buildSearchKey(value) === buildSearchKey(alias)));
    });
    if (conflicts) throw new ConflictException("导入别名与其他食材名称或别名冲突");
    const updated = await tx.ingredient.updateMany({ where: { id: ingredient.id, version: ingredient.version }, data: { aliases: nextAliases, version: { increment: 1 } } });
    if (updated.count !== 1) throw new ConflictException("食材已被其他管理员更新，请刷新后重试");
  }

  private async writeNutritionIfMissing(tx: Prisma.TransactionClient, ingredientId: number, nutrition: IngredientImportNutritionBody | null) {
    if (!nutrition) return;
    const food = await tx.nutrientFood.findFirst({ where: { sourceVersion: nutrition.sourceVersion, sourceFoodCode: nutrition.foodCode }, select: { id: true } });
    if (!food) throw new BadRequestException(`营养食品不存在：${nutrition.sourceVersion}/${nutrition.foodCode}`);
    const existing = await tx.ingredientNutrientMapping.findUnique({ where: { ingredientId_sourceVersion: { ingredientId, sourceVersion: nutrition.sourceVersion } }, select: { nutrientFoodId: true } });
    if (existing?.nutrientFoodId) {
      if (existing.nutrientFoodId !== food.id) throw new ConflictException("已有营养绑定与导入数据冲突，请人工确认");
      return;
    }
    const conversions = [] as Array<{ unitId: number; gramsPerUnit: number }>;
    for (const conversion of nutrition.conversions) {
      const unitId = await this.findSystemUnitId(tx, conversion.unitName);
      if (!unitId) throw new BadRequestException(`营养换算单位不存在：${conversion.unitName}`);
      if (conversions.some(item => item.unitId === unitId)) throw new BadRequestException(`营养换算单位不能重复：${conversion.unitName}`);
      conversions.push({ unitId, gramsPerUnit: conversion.gramsPerUnit });
    }
    await tx.ingredientNutrientMapping.upsert({
      where: { ingredientId_sourceVersion: { ingredientId, sourceVersion: nutrition.sourceVersion } },
      update: { nutrientFoodId: food.id, status: "CONFIRMED", matchType: nutrition.matchType, confidence: nutrition.confidence },
      create: { ingredientId, nutrientFoodId: food.id, status: "CONFIRMED", matchType: nutrition.matchType, confidence: nutrition.confidence, sourceVersion: nutrition.sourceVersion }
    });
    await tx.ingredientUnitNutrientConversion.deleteMany({ where: { ingredientId, sourceVersion: nutrition.sourceVersion } });
    if (conversions.length) await tx.ingredientUnitNutrientConversion.createMany({ data: conversions.map(item => ({ ingredientId, unitId: item.unitId, gramsPerUnit: item.gramsPerUnit, sourceVersion: nutrition.sourceVersion })) });
  }

  private async findSystemUnitId(tx: Prisma.TransactionClient, name: string) {
    const unit = await tx.unit.findFirst({ where: { ownerId: null, name }, select: { id: true } });
    return unit?.id ?? null;
  }

  private async writeJobStats(tx: Prisma.TransactionClient, jobId: number) {
    const [totalCount, readyCount, needsFixCount, importedCount, failedCount] = await Promise.all([
      tx.ingredientImportItem.count({ where: { jobId } }),
      tx.ingredientImportItem.count({ where: { jobId, status: "READY" } }),
      tx.ingredientImportItem.count({ where: { jobId, status: "NEEDS_FIX" } }),
      tx.ingredientImportItem.count({ where: { jobId, status: "IMPORTED" } }),
      tx.ingredientImportItem.count({ where: { jobId, status: "FAILED" } })
    ]);
    await tx.ingredientImportJob.update({ where: { id: jobId }, data: { totalCount, readyCount, needsFixCount, importedCount, failedCount, status: totalCount === 0 ? "READY" : importedCount === totalCount ? "COMPLETED" : failedCount === totalCount ? "FAILED" : "READY" } });
  }

  private async hasIngredientReference(tx: Prisma.TransactionClient, ingredientId: number) {
    const [recommendationCount, feedbackCount, fridgeCount, shoppingCount] = await Promise.all([
      tx.ingredientRecommendation.count({ where: { OR: [{ ingredientId }, { targetIngredientId: ingredientId }] } }),
      tx.ingredientFeedback.count({ where: { ingredientId } }),
      tx.fridgeItem.count({ where: { ingredientId } }),
      tx.shoppingItem.count({ where: { ingredientId } })
    ]);
    if (recommendationCount > 0 || feedbackCount > 0 || fridgeCount > 0 || shoppingCount > 0) return true;
    if (await this.hasDraftIngredientReference(tx, ingredientId)) return true;
    return this.hasRecipeVersionIngredientReference(tx, ingredientId);
  }

  private async hasDraftIngredientReference(tx: Prisma.TransactionClient, ingredientId: number) {
    const rows = await tx.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (
        SELECT 1
        FROM "recipe_drafts" AS draft
        CROSS JOIN LATERAL jsonb_array_elements(COALESCE(draft."content_json"->'ingredients', '[]'::jsonb)) AS item
        WHERE item->>'ingredientId' = ${String(ingredientId)}
      ) AS "exists"
    `;
    return rows[0]?.exists === true;
  }

  private async hasRecipeVersionIngredientReference(tx: Prisma.TransactionClient, ingredientId: number) {
    const rows = await tx.$queryRaw<Array<{ exists: boolean }>>`
      WITH "referenced_versions" AS (
        SELECT "current_version_id" AS "version_id" FROM "recipes"
        UNION
        SELECT "origin_version_id" AS "version_id" FROM "recipes" WHERE "origin_version_id" IS NOT NULL
        UNION
        SELECT "source_version_id" AS "version_id" FROM "recipe_collections"
        UNION
        SELECT "source_version_id" AS "version_id" FROM "home_topic_items"
        UNION
        SELECT "source_version_id" AS "version_id" FROM "recipe_recommendations"
        UNION
        SELECT "source_recipe_version_id" AS "version_id" FROM "shopping_items"
        UNION
        SELECT "recipe_version_id" AS "version_id" FROM "meal_plan_dishes"
        UNION
        SELECT "recipe_version_id" AS "version_id" FROM "meal_poll_candidates" WHERE "recipe_version_id" IS NOT NULL
        UNION
        SELECT "recipe_version_id" AS "version_id" FROM "dining_event_participant_bring_recipes"
        UNION
        SELECT "recipe_version_id" AS "version_id" FROM "dining_event_menu_items"
        UNION
        SELECT "recipe_version_id" AS "version_id" FROM "dining_event_wish_items"
      )
      SELECT EXISTS (
        SELECT 1
        FROM "recipe_content_versions" AS version
        INNER JOIN "referenced_versions" AS refs ON refs."version_id" = version."id"
        CROSS JOIN LATERAL jsonb_array_elements(COALESCE(version."ingredients_json", '[]'::jsonb)) AS item
        WHERE item->>'ingredientId' = ${String(ingredientId)}
      ) AS "exists"
    `;
    return rows[0]?.exists === true;
  }

  private async requireSuperAdmin(adminId: UUID) {
    const admin = await this.prisma.adminAccount.findUnique({ where: { id: adminId }, select: { status: true, roles: true } });
    if (!admin || admin.status !== "ACTIVE" || !admin.roles.includes("SUPER_ADMIN")) throw new ForbiddenException("无权执行该操作");
  }
}

function isMergedInto(candidate: IngredientMatchCandidate, targetId: number, candidates: IngredientMatchCandidate[]) {
  const visited = new Set<number>();
  let current: IngredientMatchCandidate | undefined = candidate;
  while (current?.status === "MERGED" && current.mergedToId !== null && !visited.has(current.id)) {
    if (current.mergedToId === targetId) return true;
    visited.add(current.id);
    current = candidates.find(item => item.id === current?.mergedToId);
  }
  return false;
}

function positiveInt(value: number | string | undefined, fallback: number) {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : fallback;
}

function emptyIngredientBody(): IngredientImportBody {
  return { name: "", aliases: [], categoryCode: null, defaultUnitName: null, proteinType: null, isStaple: false, isSpicyIngredient: false, imageUrl: null, nutrition: null };
}

function draftToBody(item: IngredientImportItemDraft): IngredientImportBody {
  return {
    name: item.name,
    aliases: item.aliases,
    categoryCode: item.categoryCode,
    defaultUnitName: item.defaultUnitName,
    proteinType: item.proteinType,
    isStaple: item.isStaple,
    isSpicyIngredient: item.isSpicyIngredient,
    imageUrl: item.imageUrl,
    nutrition: item.nutrition
  };
}

export function matchIngredientBody(body: IngredientImportBody, candidates: IngredientMatchCandidate[]): IngredientMatchResult {
  const terms = [body.name, ...body.aliases].filter(Boolean);
  const matches = terms.flatMap((term, index) =>
    collectIngredientMatches(term, candidates).map(match => ({
      ...match,
      matchType: index === 0 ? match.matchType : ("ALIAS" as const)
    }))
  );
  return resolveIngredientMatches(matches, candidates);
}

function toJobSummary(item: { id: number; sourceName: string; status: string; totalCount: number; readyCount: number; needsFixCount: number; importedCount: number; failedCount: number; createdByAdminId: number; createdAt: Date; updatedAt: Date }): IngredientImportJobSummary {
  return { id: item.id, sourceName: item.sourceName, status: item.status as IngredientImportJobSummary["status"], totalCount: item.totalCount, readyCount: item.readyCount, needsFixCount: item.needsFixCount, importedCount: item.importedCount, failedCount: item.failedCount, createdByAdminId: item.createdByAdminId, createdAt: item.createdAt.toISOString(), updatedAt: item.updatedAt.toISOString() };
}

export function toIngredientImportItemSummary(item: { id: number; jobId: number; sourcePath: string; title: string; status: string; errorJson: unknown; warnJson: unknown; ingredientBodyJson: unknown; ingredientId: number | null; matchType: string | null; version: number; createdAt: Date; updatedAt: Date }, categoryName: string | null): IngredientImportItemSummary {
  const errors = fromJson<RecipeImportIssue[]>(item.errorJson);
  const warnings = fromJson<RecipeImportIssue[]>(item.warnJson);
  const body = fromJson<Pick<IngredientImportBody, "categoryCode" | "defaultUnitName">>(item.ingredientBodyJson);
  return { id: item.id, jobId: item.jobId, sourcePath: item.sourcePath, title: item.title, categoryCode: body.categoryCode ?? null, categoryName, defaultUnitName: body.defaultUnitName ?? null, status: item.status as IngredientImportItemSummary["status"], errorCount: errors.length, warnCount: warnings.length, ingredientId: item.ingredientId, matchType: item.matchType, version: item.version, createdAt: item.createdAt.toISOString(), updatedAt: item.updatedAt.toISOString() };
}
