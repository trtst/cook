import { BadRequestException, ConflictException, Inject, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { isDeepStrictEqual } from "node:util";
import { PrismaService } from "../../common/prisma.service";
import { completeAdminIdempotentOperation, getAdminIdempotentResult, startAdminIdempotentOperation } from "../../common/idempotency";

const packageVersion = "cook.system-data.v1";
const maxCollectionSize = 20_000;
type DataEnvironment = "TEST" | "ONLINE";

type SystemDataPackage = {
  schemaVersion: typeof packageVersion;
  sourceEnvironment: DataEnvironment;
  exportedAt: string;
  data: Record<string, unknown[]>;
};

const collectionNames = [
  "inspirationCategories",
  "recipeContentVersions",
  "recipes",
  "recipeAssistants",
  "recipeNutritionSnapshots",
  "recipeCompletenessSnapshots",
  "recipeVersionTags",
  "ingredientCategories",
  "units",
  "ingredients",
  "nutrientFoods",
  "ingredientNutrientMappings",
  "ingredientUnitConversions"
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function dateFields<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, key.endsWith("At") && typeof item === "string" ? new Date(item) : item])
  );
}

function rowsOf(document: SystemDataPackage, key: (typeof collectionNames)[number]) {
  return document.data[key] as Array<Record<string, unknown>>;
}

function validatePackage(value: unknown): SystemDataPackage {
  if (
    !isRecord(value) ||
    value.schemaVersion !== packageVersion ||
    (value.sourceEnvironment !== "TEST" && value.sourceEnvironment !== "ONLINE") ||
    !isRecord(value.data)
  ) {
    throw new BadRequestException(`仅支持 ${packageVersion} 数据包`);
  }

  const data: Record<string, unknown[]> = {};
  let total = 0;
  for (const key of collectionNames) {
    const rows = value.data[key];
    if (!Array.isArray(rows)) throw new BadRequestException(`数据包缺少 ${key}`);
    total += rows.length;
    if (rows.some(row => !isRecord(row) || !Number.isSafeInteger(row.id) || Number(row.id) <= 0)) {
      throw new BadRequestException(`${key} 包含无效记录`);
    }
    const ids = rows.map(row => Number((row as Record<string, unknown>).id));
    if (new Set(ids).size !== ids.length) throw new BadRequestException(`${key} 存在重复 ID`);
    data[key] = rows;
  }
  if (data.recipes.some(row => !isRecord(row) || row.isInspiration !== true)) {
    throw new BadRequestException("数据包仅支持系统菜谱");
  }
  if (total > maxCollectionSize) throw new BadRequestException("数据包记录数超过 20000 条");
  return {
    schemaVersion: packageVersion,
    sourceEnvironment: value.sourceEnvironment,
    exportedAt: typeof value.exportedAt === "string" ? value.exportedAt : "",
    data
  };
}

@Injectable()
export class AdminSystemDataService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async exportPackage(): Promise<SystemDataPackage> {
    const sourceEnvironment = currentEnvironment();
    const categories = await this.prisma.inspirationCategory.findMany({ orderBy: [{ sortOrder: "asc" }, { id: "asc" }] });
    const recipeRows = await this.prisma.recipe.findMany({
      where: { isInspiration: true, inspirationCategoryId: { not: null } },
      orderBy: { id: "asc" }
    });
    const versionIds = [...new Set(recipeRows.map(row => row.currentVersionId))];
    const systemIngredients = await this.prisma.ingredient.findMany({ where: { ownerId: null }, orderBy: { id: "asc" } });
    const systemIngredientIds = systemIngredients.map(row => row.id);
    const systemUnits = await this.prisma.unit.findMany({ where: { ownerId: null }, orderBy: { id: "asc" } });
    const systemUnitIds = systemUnits.map(row => row.id);
    const [versions, assistants, nutritionSnapshots, completenessSnapshots, tags, conversions, mappings] = await Promise.all([
      versionIds.length ? this.prisma.recipeContentVersion.findMany({ where: { id: { in: versionIds } }, orderBy: { id: "asc" } }) : [],
      versionIds.length ? this.prisma.recipeCookAssistant.findMany({ where: { recipeVersionId: { in: versionIds } }, orderBy: { id: "asc" } }) : [],
      versionIds.length ? this.prisma.recipeNutritionSnapshot.findMany({ where: { recipeVersionId: { in: versionIds } }, orderBy: { id: "asc" } }) : [],
      versionIds.length ? this.prisma.recipeCompletenessSnapshot.findMany({ where: { recipeVersionId: { in: versionIds } }, orderBy: { id: "asc" } }) : [],
      versionIds.length ? this.prisma.recipeVersionTag.findMany({ where: { recipeVersionId: { in: versionIds } }, orderBy: { id: "asc" } }) : [],
      systemIngredientIds.length && systemUnitIds.length
        ? this.prisma.ingredientUnitNutrientConversion.findMany({
            where: { ingredientId: { in: systemIngredientIds }, unitId: { in: systemUnitIds } },
            orderBy: { id: "asc" }
          })
        : [],
      systemIngredientIds.length
        ? this.prisma.ingredientNutrientMapping.findMany({ where: { ingredientId: { in: systemIngredientIds } }, orderBy: { id: "asc" } })
        : []
    ]);
    const nutrientFoods = await this.prisma.nutrientFood.findMany({ orderBy: { id: "asc" } });
    const [inspirationCategories, ingredientCategories, units] = await Promise.all([
      Promise.resolve(categories),
      this.prisma.ingredientCategory.findMany({ orderBy: [{ sortOrder: "asc" }, { id: "asc" }] }),
      Promise.resolve(systemUnits)
    ]);

    const cleanVersions = versions.map(({ createdByUserId: _createdByUserId, ...version }) => version);
    const cleanAssistants = assistants.map(({ updatedByAdminId: _updatedByAdminId, ...assistant }) => assistant);
    const cleanNutrition = nutritionSnapshots.map(({ updatedByAdminId: _updatedByAdminId, ...snapshot }) => snapshot);
    const cleanRecipes = recipeRows.map(({ ownerId: _ownerId, reportCount: _reportCount, collectCount: _collectCount, ...recipe }) => recipe);

    return {
      schemaVersion: packageVersion,
      sourceEnvironment,
      exportedAt: new Date().toISOString(),
      data: {
        inspirationCategories,
        recipeContentVersions: cleanVersions,
        recipes: cleanRecipes,
        recipeAssistants: cleanAssistants,
        recipeNutritionSnapshots: cleanNutrition,
        recipeCompletenessSnapshots: completenessSnapshots,
        recipeVersionTags: tags,
        ingredientCategories,
        units,
        ingredients: systemIngredients,
        nutrientFoods,
        ingredientNutrientMappings: mappings,
        ingredientUnitConversions: conversions
      }
    };
  }

  async previewImport(value: unknown) {
    const document = validatePackage(value);
    const counts = await this.countMatches(document);
    const conflicts = await this.findConflicts(document);
    const targetEnvironment = currentEnvironment();
    const directionConflict = await this.findDirectionConflict(document.sourceEnvironment, targetEnvironment, this.prisma);
    if (directionConflict) conflicts.push(directionConflict);
    return {
      schemaVersion: packageVersion,
      targetEnvironment,
      sourceExportedAt: document.exportedAt || null,
      counts,
      conflicts,
      behavior: "按 ID 新增或覆盖；数据包未包含的线上记录保留"
    };
  }

  async importPackage(value: unknown, operationId: string, adminId: number) {
    const document = validatePackage(value);
    const requestBody = JSON.stringify(document);
    return this.prisma.$transaction(async tx => {
      const repeated = await getAdminIdempotentResult<{ schemaVersion: string; importedCount: number; counts: Record<string, unknown> }>(
        tx,
        operationId,
        "admin-system-data:import",
        adminId,
        requestBody
      );
      if (repeated) return repeated;
      const targetEnvironment = currentEnvironment();
      const directionConflict = await this.findDirectionConflict(document.sourceEnvironment, targetEnvironment, tx, true);
      if (directionConflict) throw new ConflictException(directionConflict);
      await startAdminIdempotentOperation(tx, operationId, "admin-system-data:import", adminId, requestBody);
      const pool = await tx.publicContentUserPoolMember.findMany({ orderBy: { userId: "asc" }, select: { userId: true } });
      if (document.data.recipes.length && !pool.length) throw new ConflictException("目标环境没有系统菜谱归属账号，无法导入菜谱");

      const counts = await this.countMatches(document, tx);
      await this.writeRows(tx, document, pool.map(row => row.userId));
      const result = {
        schemaVersion: packageVersion,
        targetEnvironment,
        importedCount: collectionNames.reduce((sum, key) => sum + document.data[key].length, 0),
        counts
      };
      await tx.auditEvent.create({
        data: {
          actorType: "ADMIN",
          actorAdminId: adminId,
          action: "SYSTEM_DATA_IMPORTED",
          objectType: "SYSTEM_DATA_PACKAGE",
          payload: {
            schemaVersion: packageVersion,
            sourceEnvironment: document.sourceEnvironment,
            targetEnvironment,
            importedCount: result.importedCount,
            counts,
            operationId
          } as Prisma.InputJsonValue
        }
      });
      await completeAdminIdempotentOperation(tx, operationId, "admin-system-data:import", adminId, requestBody, result);
      return result;
    }, { timeout: 120_000 });
  }

  private async countMatches(document: SystemDataPackage, db: PrismaService | Prisma.TransactionClient = this.prisma) {
    const counts: Record<string, { total: number; existing: number; new: number }> = {};
    for (const key of collectionNames) {
      const rows = rowsOf(document, key);
      const ids = rows.map(row => Number(row.id));
      let existing = 0;
      if (ids.length) {
        switch (key) {
          case "inspirationCategories": existing = await db.inspirationCategory.count({ where: { id: { in: ids } } }); break;
          case "recipeContentVersions": existing = await db.recipeContentVersion.count({ where: { id: { in: ids } } }); break;
          case "recipes": existing = await db.recipe.count({ where: { id: { in: ids }, isInspiration: true } }); break;
          case "recipeAssistants": existing = await db.recipeCookAssistant.count({ where: { id: { in: ids } } }); break;
          case "recipeNutritionSnapshots": existing = await db.recipeNutritionSnapshot.count({ where: { id: { in: ids } } }); break;
          case "recipeCompletenessSnapshots": existing = await db.recipeCompletenessSnapshot.count({ where: { id: { in: ids } } }); break;
          case "recipeVersionTags": existing = await db.recipeVersionTag.count({ where: { id: { in: ids } } }); break;
          case "ingredientCategories": existing = await db.ingredientCategory.count({ where: { id: { in: ids } } }); break;
          case "units": existing = await db.unit.count({ where: { id: { in: ids }, ownerId: null } }); break;
          case "ingredients": existing = await db.ingredient.count({ where: { id: { in: ids }, ownerId: null } }); break;
          case "nutrientFoods": existing = await db.nutrientFood.count({ where: { id: { in: ids } } }); break;
          case "ingredientNutrientMappings": existing = await db.ingredientNutrientMapping.count({ where: { id: { in: ids } } }); break;
          case "ingredientUnitConversions": existing = await db.ingredientUnitNutrientConversion.count({ where: { id: { in: ids } } }); break;
        }
      }
      counts[key] = { total: rows.length, existing, new: rows.length - existing };
    }
    return counts;
  }

  private async findConflicts(document: SystemDataPackage) {
    const conflicts: string[] = [];
    const recipeIds = rowsOf(document, "recipes").map(row => Number(row.id));
    const ingredientIds = rowsOf(document, "ingredients").map(row => Number(row.id));
    const unitIds = rowsOf(document, "units").map(row => Number(row.id));
    const versionIds = rowsOf(document, "recipeContentVersions").map(row => Number(row.id));
    const [recipes, ingredients, units, versions] = await Promise.all([
      recipeIds.length ? this.prisma.recipe.findMany({ where: { id: { in: recipeIds }, isInspiration: false }, select: { id: true } }) : [],
      ingredientIds.length ? this.prisma.ingredient.findMany({ where: { id: { in: ingredientIds }, ownerId: { not: null } }, select: { id: true } }) : [],
      unitIds.length ? this.prisma.unit.findMany({ where: { id: { in: unitIds }, ownerId: { not: null } }, select: { id: true } }) : [],
      versionIds.length ? this.prisma.recipeContentVersion.findMany({ where: { id: { in: versionIds } } }) : []
    ]);
    conflicts.push(...recipes.map(row => `菜谱 ID ${row.id} 与目标环境的非系统菜谱冲突`));
    conflicts.push(...ingredients.map(row => `食材 ID ${row.id} 与目标环境的个人食材冲突`));
    conflicts.push(...units.map(row => `单位 ID ${row.id} 与目标环境的个人单位冲突`));
    const versionById = new Map(versions.map(row => [row.id, row]));
    for (const incoming of rowsOf(document, "recipeContentVersions")) {
      const existing = versionById.get(Number(incoming.id));
      if (existing && !sameRecipeContent(existing as unknown as Record<string, unknown>, incoming)) {
        conflicts.push(`菜谱正文版本 ID ${incoming.id} 内容不同；正文版本不可覆盖`);
      }
    }
    if (recipeIds.length && !(await this.prisma.publicContentUserPoolMember.count())) {
      conflicts.push("目标环境没有公共内容池账号，无法导入系统菜谱");
    }
    return conflicts;
  }

  private async findDirectionConflict(
    sourceEnvironment: DataEnvironment,
    targetEnvironment: DataEnvironment,
    db: PrismaService | Prisma.TransactionClient,
    lockFirstOnlineImport = false
  ) {
    if (targetEnvironment === "TEST" && sourceEnvironment !== "ONLINE") {
      return "测试环境只允许导入线上数据包";
    }
    if (targetEnvironment === "ONLINE" && sourceEnvironment !== "TEST") {
      return "线上环境只允许导入测试环境的数据包";
    }
    if (targetEnvironment === "ONLINE") {
      if (lockFirstOnlineImport) {
        await db.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended('system-data-first-online-import', 0))::text`;
      }
      const alreadyImported = await db.auditEvent.findFirst({
        where: {
          action: "SYSTEM_DATA_IMPORTED",
          objectType: "SYSTEM_DATA_PACKAGE",
          payload: { path: ["sourceEnvironment"], equals: "TEST" }
        },
        select: { id: true }
      });
      if (alreadyImported) return "测试环境数据已同步到线上；线上后续只允许导入到测试环境";
    }
    return null;
  }

  private async writeRows(tx: Prisma.TransactionClient, document: SystemDataPackage, poolUserIds: number[]) {
    for (const row of rowsOf(document, "ingredientCategories")) {
      const existing = await tx.ingredientCategory.findUnique({ where: { id: Number(row.id) }, select: { version: true } });
      const values = { ...row, version: existing ? existing.version + 1 : row.version };
      await tx.ingredientCategory.upsert({ where: { id: Number(row.id) }, create: dateFields(values) as never, update: updateData(values) as never });
    }
    for (const row of rowsOf(document, "inspirationCategories")) {
      const existing = await tx.inspirationCategory.findUnique({ where: { id: Number(row.id) }, select: { version: true } });
      const values = { ...row, version: existing ? existing.version + 1 : row.version };
      await tx.inspirationCategory.upsert({ where: { id: Number(row.id) }, create: dateFields(values) as never, update: updateData(values) as never });
    }
    for (const row of rowsOf(document, "units")) {
      const existing = await tx.unit.findUnique({ where: { id: Number(row.id) }, select: { ownerId: true, version: true } });
      if (existing && existing.ownerId !== null) throw new ConflictException(`单位 ID ${row.id} 与个人单位冲突`);
      const values = { ...row, ownerId: null, version: existing ? existing.version + 1 : row.version };
      await tx.unit.upsert({ where: { id: Number(row.id) }, create: dateFields(values) as never, update: updateData(values) as never });
    }
    for (const row of rowsOf(document, "nutrientFoods")) {
      await tx.nutrientFood.upsert({ where: { id: Number(row.id) }, create: dateFields(row) as never, update: updateData(row) as never });
    }
    for (const row of rowsOf(document, "ingredients")) {
      const existing = await tx.ingredient.findUnique({ where: { id: Number(row.id) }, select: { ownerId: true, version: true } });
      if (existing && existing.ownerId !== null) throw new ConflictException(`食材 ID ${row.id} 与个人食材冲突`);
      const values = { ...row, ownerId: null, version: existing ? existing.version + 1 : row.version };
      await tx.ingredient.upsert({ where: { id: Number(row.id) }, create: dateFields(values) as never, update: updateData(values) as never });
    }
    for (const row of rowsOf(document, "ingredientNutrientMappings")) {
      await tx.ingredientNutrientMapping.upsert({ where: { id: Number(row.id) }, create: dateFields(row) as never, update: updateData(row) as never });
    }
    for (const row of rowsOf(document, "ingredientUnitConversions")) {
      await tx.ingredientUnitNutrientConversion.upsert({ where: { id: Number(row.id) }, create: dateFields(row) as never, update: updateData(row) as never });
    }
    for (const row of rowsOf(document, "recipeContentVersions")) {
      const content = await tx.recipeContentVersion.findUnique({ where: { id: Number(row.id) } });
      if (content) {
        if (!sameRecipeContent(content, row)) throw new ConflictException(`菜谱正文版本 ID ${row.id} 内容不同；正文版本不可覆盖`);
        continue;
      }
      await tx.recipeContentVersion.create({ data: dateFields({ ...row, createdByUserId: null }) as never });
    }
    for (const row of rowsOf(document, "recipes")) {
      const existing = await tx.recipe.findUnique({ where: { id: Number(row.id) }, select: { isInspiration: true, ownerId: true, reportCount: true, collectCount: true, version: true } });
      if (existing && !existing.isInspiration) throw new ConflictException(`菜谱 ID ${row.id} 与非系统菜谱冲突`);
      const ownerId = existing?.ownerId ?? poolUserIds[Number(row.id) % poolUserIds.length];
      const values = { ...row, isInspiration: true, ownerId, reportCount: existing?.reportCount ?? 0, collectCount: existing?.collectCount ?? 0, version: existing ? existing.version + 1 : row.version };
      await tx.recipe.upsert({ where: { id: Number(row.id) }, create: dateFields(values) as never, update: updateData(values) as never });
    }
    for (const row of rowsOf(document, "recipeAssistants")) {
      const values = { ...row, updatedByAdminId: null };
      await tx.recipeCookAssistant.upsert({ where: { id: Number(row.id) }, create: dateFields(values) as never, update: updateData(values) as never });
    }
    for (const row of rowsOf(document, "recipeNutritionSnapshots")) {
      const values = { ...row, updatedByAdminId: null };
      await tx.recipeNutritionSnapshot.upsert({ where: { id: Number(row.id) }, create: dateFields(values) as never, update: updateData(values) as never });
    }
    for (const row of rowsOf(document, "recipeCompletenessSnapshots")) {
      await tx.recipeCompletenessSnapshot.upsert({ where: { id: Number(row.id) }, create: dateFields(row) as never, update: updateData(row) as never });
    }
    for (const row of rowsOf(document, "recipeVersionTags")) {
      await tx.recipeVersionTag.upsert({ where: { id: Number(row.id) }, create: dateFields(row) as never, update: updateData(row) as never });
    }
    await syncSequences(tx);
  }
}

function updateData(row: Record<string, unknown>) {
  const { id: _id, ...values } = row;
  return dateFields(values);
}

function sameRecipeContent(existing: Record<string, unknown>, incoming: Record<string, unknown>) {
  const fields = ["name", "story", "baseServings", "difficulty", "duration", "estimatedCalories", "tips", "keywordsJson", "toolsJson", "ingredientsJson", "stepsJson", "imagesJson", "searchText", "contentSizeBytes"];
  return fields.every(field => isDeepStrictEqual(existing[field], incoming[field]));
}

async function syncSequences(tx: Prisma.TransactionClient) {
  const tables = ["inspiration_categories", "ingredient_categories", "units", "ingredients", "nutrient_foods", "recipes", "recipe_content_versions", "recipe_cook_assistants", "recipe_nutrition_snapshots", "recipe_completeness_snapshots", "recipe_version_tags", "ingredient_nutrient_mappings", "ingredient_unit_nutrient_conversions"];
  for (const table of tables) {
    await tx.$queryRawUnsafe(`SELECT setval(pg_get_serial_sequence('${table}', 'id'), GREATEST(COALESCE((SELECT MAX(id) FROM "${table}"), 1), 1), true)`);
  }
}

function currentEnvironment(): DataEnvironment {
  const value = process.env.SYSTEM_DATA_ENVIRONMENT?.trim().toUpperCase();
  if (value !== "TEST" && value !== "ONLINE") {
    throw new ConflictException("未配置有效的 SYSTEM_DATA_ENVIRONMENT，系统数据同步已停用");
  }
  return value;
}
