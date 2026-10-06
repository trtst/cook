import { BadRequestException, ConflictException, HttpException, Inject, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../common/prisma.service";
import { AdminRecipeImageService } from "./admin-recipe-image.service";
import { AdminService } from "./admin.service";
import { IMAGE_GENERATION_PROVIDERS, type ImageGenerationProviderId, type ImageGenerationProviderMap } from "./image-generation-provider";
import { completeAdminIdempotentOperation, getAdminIdempotentResult, startAdminIdempotentOperation } from "../../common/idempotency";
import type { AdminRecipeImageScene } from "../../contracts/types";

type ImageType = "INGREDIENT" | "RECIPE";
type TargetType = "INGREDIENT" | "RECIPE_COVER" | "RECIPE_STEP" | "WIKI_STEP";
type GenerateTarget = { targetType: TargetType; targetId: number; contentVersionId?: number; stepOrder?: number; aspectRatio?: "3:4" | "1:1" | "16:9" | "ORIGINAL"; prompt: string };
type RecipeImageTargetRow = Prisma.RecipeGetPayload<{ include: { currentVersion: { include: { cookAssistant: true } }; inspirationCategory: true; owner: { include: { publicContentPoolMember: true } } } }>;
type CandidateResult = { id: number; targetType: TargetType; targetId: number; contentVersionId: number; stepOrder: number; prompt: string; tempKey: string };
type ApplyResult = { candidateId: number; applied: true; targetType: TargetType; targetId: number };

const generationRateLimit = 10;
const generationRateWindowMs = 60_000;

function parseJson(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value === "string") {
    try { return JSON.parse(value) as Record<string, unknown>; } catch { return {}; }
  }
  return {};
}

function stepsOf(value: unknown) {
  const parsed = Array.isArray(value) ? value : parseJson(value);
  return Array.isArray(parsed) ? parsed.map(item => parseJson(item)) : [];
}

function assistantStepsOf(value: unknown) {
  const assistant = parseJson(value);
  if (assistant.status !== "READY") return [];
  const snapshot = parseJson(assistant.snapshotJson);
  return Array.isArray(snapshot.steps) ? snapshot.steps.map(item => parseJson(item)) : [];
}

@Injectable()
export class AdminImageGenerationService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AdminRecipeImageService) private readonly images: AdminRecipeImageService,
    @Inject(AdminService) private readonly admin: AdminService,
    @Inject(IMAGE_GENERATION_PROVIDERS) private readonly providers: ImageGenerationProviderMap
  ) {}

  async getSettings() {
    const row = await this.prisma.adminImageGenerationSettings.findUnique({ where: { id: 1 } });
    return {
      provider: row?.provider ?? "ARK_SEEDREAM",
      version: row?.version ?? 1,
      ingredientKeywords: row?.ingredientKeywords ?? "",
      recipeCoverKeywords: row?.recipeCoverKeywords ?? "",
      recipeStepKeywords: row?.recipeStepKeywords ?? "",
      updatedAt: row?.updatedAt.toISOString() ?? ""
    };
  }

  async saveSettings(input: { provider: ImageGenerationProviderId; expectedVersion: number; ingredientKeywords: string; recipeCoverKeywords: string; recipeStepKeywords: string }, operationId: string, adminId: number) {
    const normalized = {
      provider: input.provider,
      ingredientKeywords: input.ingredientKeywords.trim(),
      recipeCoverKeywords: input.recipeCoverKeywords.trim(),
      recipeStepKeywords: input.recipeStepKeywords.trim()
    };
    const requestHash = JSON.stringify({ ...normalized, expectedVersion: input.expectedVersion });
    return this.prisma.$transaction(async tx => {
      const repeated = await getAdminIdempotentResult<Awaited<ReturnType<AdminImageGenerationService["getSettings"]>>>(tx, operationId, "admin-image-generation:settings", adminId, requestHash);
      if (repeated) return repeated;
      await startAdminIdempotentOperation(tx, operationId, "admin-image-generation:settings", adminId, requestHash);
      const updated = await tx.adminImageGenerationSettings.updateMany({
        where: { id: 1, version: input.expectedVersion },
        data: { ...normalized, updatedByAdminId: adminId, version: { increment: 1 } }
      });
      if (updated.count !== 1) throw new ConflictException("生图共享设置已被其他管理员更新，请刷新后重试");
      const row = await tx.adminImageGenerationSettings.findUniqueOrThrow({ where: { id: 1 } });
      const result = {
        provider: row.provider,
        version: row.version,
        ingredientKeywords: row.ingredientKeywords,
        recipeCoverKeywords: row.recipeCoverKeywords,
        recipeStepKeywords: row.recipeStepKeywords,
        updatedAt: row.updatedAt.toISOString()
      };
      await completeAdminIdempotentOperation(tx, operationId, "admin-image-generation:settings", adminId, requestHash, result);
      return result;
    });
  }

  async listTargets(input: { type: ImageType; categoryId?: number; missingOnly?: boolean; recipeImageFilter?: "ALL" | "ANY" | "COVER" | "STEP" | "WIKI_STEP"; page?: number; pageSize?: number }) {
    const page = input.page ?? 1;
    const pageSize = input.pageSize ?? 20;
    const skip = (page - 1) * pageSize;
    if (input.type === "INGREDIENT") {
      const where = { ownerId: null, status: "ACTIVE" as const, ...(input.categoryId ? { categoryId: input.categoryId } : {}), ...(input.missingOnly ? { imageUrl: null } : {}) };
      const [rows, total] = await Promise.all([
        this.prisma.ingredient.findMany({ where, include: { category: true }, orderBy: [{ categoryId: "asc" }, { displaySortOrder: "asc" }, { id: "asc" }], skip, take: pageSize }),
        this.prisma.ingredient.count({ where })
      ]);
      const candidates = await this.prisma.adminImageGenerationCandidate.findMany({ where: { assetType: "INGREDIENT", targetId: { in: rows.map(row => row.id) } } });
      const candidatesByKey = new Map(candidates.map(item => [`${item.targetType}:${item.targetId}:${item.contentVersionId}:${item.stepOrder}`, this.toCandidateResult(item)]));
      return { items: rows.map(row => ({ id: row.id, title: row.name, categoryId: row.categoryId, categoryName: row.category.name, version: row.version, missingCount: row.imageUrl ? 0 : 1, slots: [{ targetType: "INGREDIENT" as const, targetId: row.id, contentVersionId: 0, stepOrder: 0, label: "食材图", imageUrl: row.imageUrl, imagePrompt: row.name, candidate: candidatesByKey.get(`INGREDIENT:${row.id}:0:0`) ?? null }] })), page, pageSize, total, hasNext: skip + rows.length < total };
    }

    const where = { status: "ACTIVE" as const, ...(input.categoryId ? { inspirationCategoryId: input.categoryId } : {}) };
    let rows: RecipeImageTargetRow[];
    let totalRecords: number;
    const recipeImageFilter = input.recipeImageFilter ?? (input.missingOnly === false ? "ALL" : "ANY");
    if (recipeImageFilter !== "ALL") {
      const categoryFilter = input.categoryId ? Prisma.sql`AND recipe."inspiration_category_id" = ${input.categoryId}` : Prisma.empty;
      const publicPoolSystemRecipe = Prisma.sql`(
        recipe."is_inspiration" AND recipe."inspiration_category_id" IS NOT NULL AND EXISTS (
          SELECT 1 FROM "public_content_user_pool_members" AS pool_member WHERE pool_member."user_id" = recipe."owner_id"
        )
      )`;
      const missingCover = Prisma.sql`${publicPoolSystemRecipe} AND NULLIF(recipe."cover_image_url", '') IS NULL`;
      const missingRecipeStep = Prisma.sql`${publicPoolSystemRecipe} AND EXISTS (
        SELECT 1
        FROM jsonb_array_elements(CASE WHEN jsonb_typeof(version."steps_json") = 'array' THEN version."steps_json" ELSE '[]'::jsonb END) AS content_step(step)
        WHERE NULLIF(content_step.step->>'imageUrl', '') IS NULL
      )`;
      const missingWikiStep = Prisma.sql`EXISTS (
        SELECT 1
        FROM "recipe_cook_assistants" AS assistant
        CROSS JOIN LATERAL jsonb_array_elements(
          CASE
            WHEN assistant."status" = 'READY' AND jsonb_typeof(assistant."snapshot_json"->'steps') = 'array'
              THEN assistant."snapshot_json"->'steps'
            ELSE '[]'::jsonb
          END
        ) AS wiki_steps(step)
        WHERE assistant."recipe_version_id" = version."id"
          AND NULLIF(wiki_steps.step->>'imageUrl', '') IS NULL
      )`;
      const missingPredicate = {
        ANY: Prisma.sql`(${missingCover} OR ${missingRecipeStep} OR ${missingWikiStep})`,
        COVER: missingCover,
        STEP: missingRecipeStep,
        WIKI_STEP: missingWikiStep
      }[recipeImageFilter];
      const [{ total }] = await this.prisma.$queryRaw<Array<{ total: bigint }>>(Prisma.sql`
        SELECT COUNT(*)::bigint AS total
        FROM "recipes" AS recipe
        INNER JOIN "recipe_content_versions" AS version ON version."id" = recipe."current_version_id"
        WHERE recipe."status" = 'ACTIVE'
          ${categoryFilter}
          AND ${missingPredicate}
      `);
      totalRecords = Number(total);
      const targetRows = await this.prisma.$queryRaw<Array<{ id: number }>>(Prisma.sql`
        SELECT recipe."id"
        FROM "recipes" AS recipe
        INNER JOIN "recipe_content_versions" AS version ON version."id" = recipe."current_version_id"
        WHERE recipe."status" = 'ACTIVE'
          ${categoryFilter}
          AND ${missingPredicate}
        ORDER BY recipe."updated_at" DESC, recipe."id" DESC
        OFFSET ${skip}
        LIMIT ${pageSize}
      `);
      const targetIds = targetRows.map(row => row.id);
      const pageRows = targetIds.length
        ? await this.prisma.recipe.findMany({ where: { ...where, id: { in: targetIds } }, include: { currentVersion: { include: { cookAssistant: true } }, inspirationCategory: true, owner: { include: { publicContentPoolMember: true } } } })
        : [];
      const rowsById = new Map(pageRows.map(row => [row.id, row]));
      rows = targetIds.flatMap(id => {
        const row = rowsById.get(id);
        return row ? [row] : [];
      });
    } else {
      const [pageRows, total] = await Promise.all([
        this.prisma.recipe.findMany({ where, include: { currentVersion: { include: { cookAssistant: true } }, inspirationCategory: true, owner: { include: { publicContentPoolMember: true } } }, orderBy: [{ updatedAt: "desc" }, { id: "desc" }], skip, take: pageSize }),
        this.prisma.recipe.count({ where })
      ]);
      rows = pageRows;
      totalRecords = total;
    }
    const candidates = await this.prisma.adminImageGenerationCandidate.findMany({ where: { assetType: "RECIPE", targetId: { in: rows.map(row => row.id) }, contentVersionId: { in: rows.map(row => row.currentVersionId) } } });
    const candidatesByKey = new Map(candidates.map(item => [`${item.targetType}:${item.targetId}:${item.contentVersionId}:${item.stepOrder}`, this.toCandidateResult(item)]));
    const matchedItems = rows.map(recipe => {
      const contentSteps = stepsOf(recipe.currentVersion.stepsJson);
      const wikiSteps = assistantStepsOf(recipe.currentVersion.cookAssistant);
      const slots: Array<Record<string, unknown>> = [];
      const addSlot = (targetType: TargetType, stepOrder: number, imageUrl: unknown, imagePrompt: unknown, label: string) => {
        const candidate = candidatesByKey.get(`${targetType}:${recipe.id}:${recipe.currentVersionId}:${stepOrder}`) ?? null;
        slots.push({ targetType, targetId: recipe.id, contentVersionId: recipe.currentVersionId, stepOrder, label, imageUrl: typeof imageUrl === "string" ? imageUrl : null, imagePrompt: typeof imagePrompt === "string" ? imagePrompt : null, candidate });
      };
      const isPublicPoolSystemRecipe = recipe.isInspiration && recipe.inspirationCategoryId !== null && recipe.owner.publicContentPoolMember !== null;
      if (isPublicPoolSystemRecipe) {
        addSlot("RECIPE_COVER", 0, recipe.coverImageUrl, recipe.title, "封面图");
        contentSteps.forEach((step, index) => addSlot("RECIPE_STEP", index + 1, step.imageUrl, step.imagePrompt ?? step.text, `制作步骤 ${index + 1}`));
      }
      wikiSteps.forEach((step, index) => addSlot("WIKI_STEP", Number(step.order) || index + 1, step.imageUrl, step.imagePrompt ?? step.detail ?? step.title, `Wiki 步骤 ${Number(step.order) || index + 1}`));
      const missingCount = slots.filter(slot => !slot.imageUrl).length;
      return { id: recipe.id, title: recipe.title, categoryId: recipe.inspirationCategoryId, categoryName: recipe.inspirationCategory?.name ?? "个人菜谱", missingCount, slots };
    });
    const total = totalRecords;
    const items = matchedItems;
    return { items, page, pageSize, total, hasNext: skip + items.length < total };
  }

  async generate(target: GenerateTarget, operationId: string, adminId: number): Promise<CandidateResult> {
    const prompt = target.prompt.trim();
    if (!prompt || prompt.length > 1000) throw new BadRequestException("图片关键词不能为空且不能超过 1000 字");
    if (!Number.isSafeInteger(target.targetId) || target.targetId < 1) throw new BadRequestException("目标 ID 无效");
    const normalizedTarget = { ...target, prompt };
    const requestHash = JSON.stringify(normalizedTarget);
    const cached = await this.reserveGeneration(operationId, requestHash, adminId);
    if (cached) return cached;
    const scene: AdminRecipeImageScene = target.targetType === "INGREDIENT" ? "INGREDIENT" : target.targetType === "RECIPE_COVER" ? "COVER" : "STEP";
    const aspectRatio = target.targetType === "INGREDIENT" ? "1:1" : target.aspectRatio ?? "3:4";
    let tempKey: string | null = null;
    try {
      await this.assertGenerationTarget(normalizedTarget);
      const selectedProvider = await this.prisma.adminImageGenerationSettings.findUnique({ where: { id: 1 }, select: { provider: true } });
      const provider = this.providers[selectedProvider?.provider ?? "ARK_SEEDREAM"];
      const generated = await provider.generate(prompt, { aspectRatio });
      const staged = await this.images.stageGeneratedTempImageFromUrl(scene, generated.imageUrl);
      tempKey = staged.image.tempKey;
      const old = await this.prisma.adminImageGenerationCandidate.findFirst({ where: { targetType: target.targetType, targetId: target.targetId, contentVersionId: target.contentVersionId ?? 0, stepOrder: target.stepOrder ?? 0 } });
      const result = await this.prisma.$transaction(async tx => {
        const candidate = await tx.adminImageGenerationCandidate.upsert({
          where: { targetType_targetId_contentVersionId_stepOrder: { targetType: target.targetType, targetId: target.targetId, contentVersionId: target.contentVersionId ?? 0, stepOrder: target.stepOrder ?? 0 } },
          update: { tempKey: tempKey!, prompt, createdByAdminId: adminId, createdAt: new Date() },
          create: { assetType: target.targetType === "INGREDIENT" ? "INGREDIENT" : "RECIPE", targetType: target.targetType, targetId: target.targetId, contentVersionId: target.contentVersionId ?? 0, stepOrder: target.stepOrder ?? 0, tempKey: tempKey!, prompt, createdByAdminId: adminId }
        });
        const candidateResult = this.toCandidateResult(candidate);
        const completed = await completeAdminIdempotentOperation(tx, operationId, "admin-image-generation:generate", adminId, requestHash, candidateResult);
        if (completed.count !== 1) throw new ConflictException("生图请求状态已变化，请刷新后重试");
        return candidateResult;
      });
      if (old?.tempKey && old.tempKey !== tempKey) await this.discardTempImages([old.tempKey], adminId, "ADMIN_IMAGE_GENERATION_CANDIDATE", old.id, "replace_candidate");
      return result;
    } catch (error) {
      if (tempKey) await this.discardTempImages([tempKey], adminId, "ADMIN_IMAGE_GENERATION_TARGET", target.targetId, "generation_failed");
      await this.prisma.idempotencyRecord.updateMany({
        where: { operationId, operationType: "admin-image-generation:generate", adminId, status: "PROCESSING" },
        data: { status: "FAILED" }
      });
      throw error;
    }
  }

  private async reserveGeneration(operationId: string, requestHash: string, adminId: number): Promise<CandidateResult | null> {
    return this.prisma.$transaction(async tx => {
      const repeated = await getAdminIdempotentResult<CandidateResult>(tx, operationId, "admin-image-generation:generate", adminId, requestHash);
      if (repeated) return repeated;
      const existing = await tx.idempotencyRecord.findFirst({ where: { operationId, operationType: "admin-image-generation:generate", adminId } });
      if (existing) {
        if (existing.status === "PROCESSING") throw new ConflictException("相同生图请求正在处理中");
        throw new ConflictException("该生图请求已失败，请使用新的请求键重试");
      }
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`ADMIN_IMAGE_GENERATION_RATE:${adminId}`}, 0))::text`;
      const windowStart = new Date(Date.now() - generationRateWindowMs);
      const requestCount = await tx.idempotencyRecord.count({
        where: { adminId, operationType: "admin-image-generation:generate", createdAt: { gte: windowStart } }
      });
      if (requestCount >= generationRateLimit) {
        throw new HttpException({ code: 429, message: "一分钟内最多生成 10 张候选图，请稍后重试", data: null }, 429);
      }
      await startAdminIdempotentOperation(tx, operationId, "admin-image-generation:generate", adminId, requestHash);
      return null;
    });
  }

  private toCandidateResult(candidate: { id: number; targetType: TargetType; targetId: number; contentVersionId: number; stepOrder: number; prompt: string; tempKey: string }): CandidateResult {
    return {
      id: candidate.id,
      targetType: candidate.targetType,
      targetId: candidate.targetId,
      contentVersionId: candidate.contentVersionId,
      stepOrder: candidate.stepOrder,
      prompt: candidate.prompt,
      tempKey: candidate.tempKey
    };
  }

  private async discardTempImages(tempKeys: string[], adminId: number, objectType: string, objectId: number, phase: string) {
    const failedTempKeys = await this.images.discardTempImages(tempKeys);
    if (!failedTempKeys.length) return;
    try {
      await this.prisma.auditEvent.create({
        data: {
          actorType: "ADMIN",
          actorAdminId: adminId,
          action: "ADMIN_IMAGE_GENERATION_CLEANUP_FAILED",
          objectType,
          objectId,
          payload: { tempKeys: failedTempKeys, phase }
        }
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown error";
      console.error(`[admin] image generation cleanup audit failed for ${objectType} ${objectId}, phase=${phase}: ${message}`);
    }
  }

  private async assertGenerationTarget(target: GenerateTarget) {
    if (target.targetType === "INGREDIENT") {
      const ingredient = await this.prisma.ingredient.findFirst({ where: { id: target.targetId, ownerId: null, status: "ACTIVE" } });
      if (!ingredient) throw new BadRequestException("系统食材不存在或不可用");
      return;
    }
    const recipe = await this.prisma.recipe.findFirst({ where: { id: target.targetId, status: "ACTIVE" }, include: { currentVersion: { include: { cookAssistant: true } }, owner: { include: { publicContentPoolMember: true } } } });
    if (!recipe) throw new BadRequestException("菜谱不存在或不可用");
    if (target.contentVersionId !== recipe.currentVersionId) throw new BadRequestException("菜谱正文版本已变化，请刷新列表");
    const isPublicPoolSystemRecipe = recipe.isInspiration && recipe.inspirationCategoryId !== null && recipe.owner.publicContentPoolMember !== null;
    if (target.targetType === "RECIPE_COVER" || target.targetType === "RECIPE_STEP") {
      if (!isPublicPoolSystemRecipe) throw new BadRequestException("仅公共内容池用户发布的系统菜谱支持生成封面或制作步骤图");
      if (target.targetType === "RECIPE_STEP") {
        const order = target.stepOrder;
        if (!order || order > stepsOf(recipe.currentVersion.stepsJson).length) throw new BadRequestException("菜谱步骤不存在");
      }
      return;
    }
    const wikiSteps = assistantStepsOf(recipe.currentVersion.cookAssistant);
    if (!target.stepOrder || !wikiSteps.some((step, index) => (Number(step.order) || index + 1) === target.stepOrder)) throw new BadRequestException("Wiki 步骤不存在或尚未准备好");
  }

  async deleteCandidate(candidateId: number, operationId: string, adminId: number) {
    const requestHash = String(candidateId);
    const outcome = await this.prisma.$transaction(async tx => {
      const repeated = await getAdminIdempotentResult<{ deleted: boolean }>(tx, operationId, "admin-image-generation:candidate-delete", adminId, requestHash);
      if (repeated) return { result: repeated, tempKey: null as string | null };
      await startAdminIdempotentOperation(tx, operationId, "admin-image-generation:candidate-delete", adminId, requestHash);
      const candidate = await tx.adminImageGenerationCandidate.findUnique({ where: { id: candidateId } });
      if (candidate) await tx.adminImageGenerationCandidate.delete({ where: { id: candidateId } });
      const result = { deleted: true };
      await completeAdminIdempotentOperation(tx, operationId, "admin-image-generation:candidate-delete", adminId, requestHash, result);
      return { result, tempKey: candidate?.tempKey ?? null };
    });
    if (outcome.tempKey) await this.discardTempImages([outcome.tempKey], adminId, "ADMIN_IMAGE_GENERATION_CANDIDATE", candidateId, "candidate_deleted");
    return outcome.result;
  }

  async applyCandidate(request: { protocol?: string; get?: (name: string) => string | undefined }, candidateId: number, operationId: string, expectedVersion: number | undefined, adminId: number): Promise<ApplyResult> {
    const requestHash = JSON.stringify({ candidateId, expectedVersion: expectedVersion ?? null });
    const cached = await this.reserveApply(operationId, requestHash, adminId);
    if (cached) return cached;
    try {
      const candidate = await this.prisma.adminImageGenerationCandidate.findUnique({ where: { id: candidateId } });
      if (!candidate) throw new BadRequestException("生图候选已失效");
      if (candidate.targetType === "INGREDIENT") {
        if (!expectedVersion) throw new BadRequestException("缺少食材版本号");
        const buffer = await this.images.readTempImageBuffer(candidate.tempKey);
        await this.admin.uploadIngredientImage(request, candidate.targetId, operationId, expectedVersion, { buffer, size: buffer.length }, adminId);
      } else if (candidate.targetType === "RECIPE_COVER" || candidate.targetType === "RECIPE_STEP" || candidate.targetType === "WIKI_STEP") {
        const recipe = await this.prisma.recipe.findFirst({ where: { id: candidate.targetId, status: "ACTIVE" }, select: { isInspiration: true, inspirationCategoryId: true, currentVersionId: true, owner: { select: { publicContentPoolMember: { select: { userId: true } } } } } });
        if (!recipe) throw new BadRequestException("菜谱不存在或不可用");
        const isPublicPoolSystemRecipe = recipe.isInspiration && recipe.inspirationCategoryId !== null && recipe.owner.publicContentPoolMember !== null;
        if (candidate.targetType !== "WIKI_STEP" && !isPublicPoolSystemRecipe) throw new BadRequestException("仅公共内容池用户发布的系统菜谱支持替换封面或制作步骤图片");
        if (candidate.targetType === "WIKI_STEP" && !isPublicPoolSystemRecipe) {
          const document = await this.admin.exportRecipeWiki(candidate.targetId, adminId);
          if (document.contentVersionId !== candidate.contentVersionId || recipe.currentVersionId !== candidate.contentVersionId) throw new BadRequestException("菜谱正文版本已变化，请重新生成候选图");
          const assistant = document.wiki.assistant;
          const step = assistant.steps.find(item => item.order === candidate.stepOrder);
          if (!step) throw new BadRequestException("Wiki 步骤已变化，请刷新后重试");
          const steps = assistant.steps.map(item => item.order === candidate.stepOrder ? { ...item, imageUrl: null, imageTempKey: candidate.tempKey } : item);
          const payload = Buffer.from(JSON.stringify({ ...document, wiki: { ...document.wiki, assistant: { steps } } }));
          const result = await this.admin.importRecipeWiki(payload, operationId, adminId);
          if (result.rejectedCount) throw new BadRequestException(result.items[0]?.message ?? "Wiki 图片回填失败");
        } else {
          const suffix = candidate.targetType === "RECIPE_COVER" ? "" : candidate.targetType === "WIKI_STEP" ? `_step_wiki${candidate.stepOrder}` : `_step${candidate.stepOrder}`;
          const result = await this.admin.backfillRecipeImages(request, candidate.targetId, { operationId, images: [{ fileName: `${candidate.contentVersionId}_${candidate.targetId}${suffix}.jpg`, tempKey: candidate.tempKey }] }, adminId);
          if (result.nextContentVersionId !== result.contentVersionId) {
            await this.prisma.adminImageGenerationCandidate.updateMany({ where: { targetId: candidate.targetId, assetType: "RECIPE", contentVersionId: result.contentVersionId, id: { not: candidate.id } }, data: { contentVersionId: result.nextContentVersionId } });
          }
        }
      } else {
        throw new BadRequestException("不支持的生图目标");
      }
      const result: ApplyResult = { candidateId, applied: true, targetType: candidate.targetType, targetId: candidate.targetId };
      const completed = await this.prisma.$transaction(async tx => {
        const repeated = await getAdminIdempotentResult<ApplyResult>(tx, operationId, "admin-image-generation:candidate-apply", adminId, requestHash);
        if (repeated) return repeated;
        await tx.adminImageGenerationCandidate.delete({ where: { id: candidate.id } });
        const count = await completeAdminIdempotentOperation(tx, operationId, "admin-image-generation:candidate-apply", adminId, requestHash, result);
        if (count.count !== 1) throw new ConflictException("图片回填请求状态已变化，请刷新后重试");
        return result;
      });
      await this.discardTempImages([candidate.tempKey], adminId, "ADMIN_IMAGE_GENERATION_CANDIDATE", candidate.id, "candidate_applied");
      return completed;
    } catch (error) {
      await this.prisma.idempotencyRecord.updateMany({
        where: { operationId, operationType: "admin-image-generation:candidate-apply", adminId, status: "PROCESSING" },
        data: { status: "FAILED" }
      });
      throw error;
    }
  }

  private async reserveApply(operationId: string, requestHash: string, adminId: number): Promise<ApplyResult | null> {
    return this.prisma.$transaction(async tx => {
      const repeated = await getAdminIdempotentResult<ApplyResult>(tx, operationId, "admin-image-generation:candidate-apply", adminId, requestHash);
      if (repeated) return repeated;
      const existing = await tx.idempotencyRecord.findFirst({ where: { operationId, operationType: "admin-image-generation:candidate-apply", adminId } });
      if (existing?.status === "FAILED") {
        await tx.idempotencyRecord.updateMany({
          where: { operationId, operationType: "admin-image-generation:candidate-apply", adminId, status: "FAILED" },
          data: { status: "PROCESSING", resultJson: Prisma.DbNull }
        });
      } else if (!existing) {
        await startAdminIdempotentOperation(tx, operationId, "admin-image-generation:candidate-apply", adminId, requestHash);
      }
      return null;
    });
  }
}
