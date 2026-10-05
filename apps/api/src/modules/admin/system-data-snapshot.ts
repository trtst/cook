import { BadRequestException } from "@nestjs/common";
import { Prisma } from "@prisma/client";

export const snapshotVersion = "cook.data-snapshot.v2" as const;

export const snapshotCategoryLabels = {
  users: "用户及个人数据",
  medals: "勋章",
  recipeCategories: "菜谱分类",
  recipes: "菜谱",
  ingredientCategories: "食材分类",
  systemIngredients: "系统食材",
  nutrientFoods: "食材营养表",
  units: "单位",
  articles: "文章",
  articleChannels: "文章栏目"
} as const;

export type SnapshotCategory = keyof typeof snapshotCategoryLabels;
export type SnapshotRows = Record<string, Array<Record<string, unknown>>>;
export type SnapshotDocument = {
  schemaVersion: typeof snapshotVersion;
  sourceEnvironment: "TEST" | "ONLINE";
  exportedAt: string;
  categories: SnapshotCategory[];
  counts: Record<string, number>;
  data: Record<SnapshotCategory, SnapshotRows>;
  assets: Array<{ path: string; sha256: string; contentType: string; size: number }>;
};

const userModels = [
  "User", "UserTasteProfile", "UserNotificationSettings", "UserNotificationState", "UserNotificationRead",
  "EntitlementGrant", "RecipeCategory", "RecipeScene", "Recipe", "RecipeContentVersion", "RecipeCookAssistant",
  "RecipeNutritionSnapshot", "RecipeCompletenessSnapshot", "RecipeVersionTag", "RecipeViewHistory", "RecipeSceneLink",
  "RecipeCollection", "RecipeCollectionScene", "RecipeDraft", "RecipeDraftScene", "UploadAsset", "RecipeReport",
  "RecipeRecommendation", "RecipeCookAssistantRequest", "CookAssistantUnlock", "RandomMenuUsage", "Unit",
  "UnitRecommendation", "Ingredient", "IngredientRecommendation", "IngredientFeedback", "IngredientNutrientMapping",
  "IngredientUnitNutrientConversion", "MealPlanItem", "MealPlanDish", "MealPlanCookAssistant", "DiningEvent",
  "DiningEventParticipant", "DiningEventParticipantBringRecipe",
  "DiningEventWishItem", "DiningEventWishSupport", "MealPoll", "MealPollCandidate", "MealPollResponse",
  "MealPollResponseItem", "DiningEventMenuItem", "DiningEventPreparation", "ShoppingList", "ShoppingListMember",
  "ShoppingItem", "FridgeTrace", "FridgeMaintenanceEvent", "UserMedal",
  "SiteContentLike", "TableTopicParticipant"
] as const;

const categoryModels: Record<SnapshotCategory, readonly string[]> = {
  users: userModels,
  medals: ["MedalTemplate"],
  recipeCategories: ["InspirationCategory"],
  recipes: ["Recipe", "RecipeContentVersion", "RecipeCookAssistant", "RecipeNutritionSnapshot", "RecipeCompletenessSnapshot", "RecipeVersionTag"],
  ingredientCategories: ["IngredientCategory"],
  systemIngredients: ["Ingredient"],
  nutrientFoods: ["NutrientSourceBatch", "NutrientSourceFood", "NutrientFood", "IngredientNutrientMapping", "IngredientUnitNutrientConversion"],
  units: ["Unit", "IngredientUnitNutrientConversion"],
  articles: ["SiteContent"],
  articleChannels: ["SiteContentChannel"]
};

const categoryRoots: Record<SnapshotCategory, string[]> = {
  users: ["User"], medals: ["MedalTemplate"], recipeCategories: ["InspirationCategory"], recipes: ["Recipe"],
  ingredientCategories: ["IngredientCategory"], systemIngredients: ["Ingredient"], nutrientFoods: ["NutrientSourceBatch", "NutrientFood"],
  units: ["Unit"], articles: ["SiteContent"], articleChannels: ["SiteContentChannel"]
};

const modelCategory: Partial<Record<string, SnapshotCategory>> = Object.fromEntries(
  Object.entries(categoryModels).flatMap(([category, models]) => models.map(model => [model, category as SnapshotCategory]))
);

type PrismaModelInfo = {
  name: string;
  dbName: string | null;
  fields: Array<{ name: string; kind: string; type: string; isList: boolean; relationFromFields: string[]; relationToFields: string[] }>;
  primaryKey?: { fields: string[] } | null;
};

type DynamicDelegate = {
  findMany(args?: unknown): Promise<Array<Record<string, unknown>>>;
  deleteMany(args?: unknown): Promise<{ count: number }>;
  createMany(args?: unknown): Promise<{ count: number }>;
  upsert(args?: unknown): Promise<unknown>;
  count(args?: unknown): Promise<number>;
};

export function snapshotCategories(value: unknown): SnapshotCategory[] {
  if (!Array.isArray(value) || value.length === 0) throw new BadRequestException("请至少选择一个数据类别");
  const categories = Array.from(new Set(value));
  if (categories.some(item => typeof item !== "string" || !(item in snapshotCategoryLabels))) {
    throw new BadRequestException("快照包含未知数据类别");
  }
  return categories as SnapshotCategory[];
}

export function snapshotModels(categories: SnapshotCategory[]) {
  return Array.from(new Set(categories.flatMap(category => categoryModels[category])));
}

export function snapshotRoots(category: SnapshotCategory) {
  return categoryRoots[category];
}

export function snapshotModelWhere(model: string, category: SnapshotCategory) {
  if (model === "User") return { phone: { not: null } };
  if (model === "Recipe") return category === "users" ? { isInspiration: false } : { isInspiration: true, inspirationCategoryId: { not: null } };
  if (model === "Ingredient" || model === "Unit") return category === "users" ? { ownerId: { not: null } } : { ownerId: null };
  if (model === "UploadAsset") return { status: "BOUND" };
  return {};
}

function delegateFor(db: object, modelName: string) {
  const key = modelName[0].toLowerCase() + modelName.slice(1);
  const delegate = (db as Record<string, unknown>)[key] as DynamicDelegate | undefined;
  if (!delegate) throw new Error(`快照模型未注册：${modelName}`);
  return delegate;
}

function modelInfo(modelName: string): PrismaModelInfo {
  const info = Prisma.dmmf.datamodel.models.find(model => model.name === modelName);
  if (!info) throw new Error(`Prisma 模型不存在：${modelName}`);
  return info as unknown as PrismaModelInfo;
}

function primaryFields(modelName: string) {
  const info = modelInfo(modelName);
  return info.primaryKey?.fields ?? info.fields.filter(field => (field as unknown as { isId?: boolean }).isId).map(field => field.name);
}

function keyOf(modelName: string, row: Record<string, unknown>) {
  return JSON.stringify(primaryFields(modelName).map(field => row[field]));
}

function scrubUser(row: Record<string, unknown>) {
  return { ...row, passwordHash: null, openid: null, unionid: null, sessionVersion: Number(row.sessionVersion ?? 0) + 1 };
}

export async function collectCategoryRows(db: object, category: SnapshotCategory) {
  const allowed = new Set(categoryModels[category]);
  const rows: SnapshotRows = {};
  const add = (modelName: string, values: Array<Record<string, unknown>>) => {
    const bucket = rows[modelName] ?? (rows[modelName] = []);
    const seen = new Set(bucket.map(row => keyOf(modelName, row)));
    for (const value of values) {
      if (seen.has(keyOf(modelName, value))) continue;
      if (modelName === "User") bucket.push(scrubUser(value));
      else if (modelName === "Recipe" && value.isInspiration === true) bucket.push({ ...value, ownerId: null, reportCount: 0, collectCount: 0 });
      else if (modelName === "DiningEvent") {
        const event = { ...value };
        delete event.coverStorageKey;
        delete event.coverContentType;
        delete event.shareTokenHash;
        delete event.shareTokenExpiresAt;
        delete event.memoryMiniCodeStorageKey;
        delete event.memoryShareStartedAt;
        bucket.push(event);
      } else if (modelName === "SiteContent") bucket.push({ ...value, updatedByAdminId: null });
      else if (modelName === "RecipeCookAssistant" || modelName === "RecipeNutritionSnapshot") bucket.push({ ...value, updatedByAdminId: null });
      else if (modelName === "RecipeContentVersion" && category !== "users") bucket.push({ ...value, createdByUserId: null });
      else bucket.push(value);
      seen.add(keyOf(modelName, value));
    }
  };
  const queue: Array<{ model: string; category: SnapshotCategory }> = [];
  const userIds = category === "users"
    ? await delegateFor(db, "User").findMany({ where: snapshotModelWhere("User", category), select: { id: true } }).then(rows => rows.map(row => row.id))
    : [];
  for (const model of categoryRoots[category]) {
    const found = await delegateFor(db, model).findMany({ where: snapshotModelWhere(model, category), orderBy: primaryFields(model).map(field => ({ [field]: "asc" })) });
    add(model, found);
    queue.push({ model, category });
  }

  const edges: Array<{ child: string; parent: string; from: string[]; to: string[] }> = [];
  for (const childName of allowed) {
    for (const field of modelInfo(childName).fields) {
      if (field.kind === "object" && field.relationFromFields.length) {
        edges.push({ child: childName, parent: field.type, from: field.relationFromFields, to: field.relationToFields });
      }
    }
  }

  const traversed = new Set<string>();
  while (queue.length) {
    const current = queue.shift()!;
    for (const edge of edges) {
      if (edge.child !== current.model && edge.parent !== current.model) continue;
      const nextModel = edge.child === current.model ? edge.parent : edge.child;
      if (!allowed.has(nextModel)) continue;
      const edgeKey = `${current.model}:${edge.child}:${edge.from.join(",")}:${edge.to.join(",")}:${(rows[current.model] ?? []).map(row => keyOf(current.model, row)).join("|")}`;
      if (traversed.has(edgeKey)) continue;
      traversed.add(edgeKey);
      const currentRows = rows[current.model] ?? [];
      if (!currentRows.length) continue;
      const sourceFields = edge.child === current.model ? edge.from : edge.to;
      const targetFields = edge.child === current.model ? edge.to : edge.from;
      let hasFoundRows = false;
      for (let offset = 0; offset < currentRows.length; offset += 300) {
        const tuples = currentRows.slice(offset, offset + 300).map(row => Object.fromEntries(
          sourceFields.map((field, index) => [targetFields[index], row[field]])
        )).filter(tuple => Object.values(tuple).every(value => value !== null && value !== undefined));
        if (!tuples.length) continue;
        const relationWhere = targetFields.length === 1
          ? { [targetFields[0]]: { in: Array.from(new Set(tuples.map(tuple => tuple[targetFields[0]]))) } }
          : { OR: tuples };
        const categoryWhere = snapshotModelWhere(nextModel, category);
        const where = category === "users" && (nextModel === "Ingredient" || nextModel === "Unit")
          ? { AND: [relationWhere, categoryWhere, { ownerId: { in: userIds } }] }
          : { AND: [relationWhere, categoryWhere] };
        const found = await delegateFor(db, nextModel).findMany({ where });
        const before = rows[nextModel]?.length ?? 0;
        add(nextModel, found);
        if ((rows[nextModel]?.length ?? 0) > before) hasFoundRows = true;
      }
      if (hasFoundRows) queue.push({ model: nextModel, category });
    }
  }
  return rows;
}

export function mergeSnapshotRows(target: SnapshotRows, source: SnapshotRows) {
  for (const [model, incoming] of Object.entries(source)) {
    const current = target[model] ?? (target[model] = []);
    const seen = new Set(current.map(row => keyOf(model, row)));
    for (const row of incoming) if (!seen.has(keyOf(model, row))) current.push(row);
  }
  return target;
}

export function validateSnapshotDocument(value: unknown): SnapshotDocument {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new BadRequestException("快照清单格式无效");
  const candidate = value as Record<string, unknown>;
  if (candidate.schemaVersion !== snapshotVersion || (candidate.sourceEnvironment !== "TEST" && candidate.sourceEnvironment !== "ONLINE")) {
    throw new BadRequestException(`仅支持 ${snapshotVersion} 数据包`);
  }
  const categories = snapshotCategories(candidate.categories);
  const data = candidate.data as Record<SnapshotCategory, SnapshotRows>;
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new BadRequestException("快照数据清单无效");
  if (Object.keys(data).length !== categories.length || Object.keys(data).some(category => !categories.includes(category as SnapshotCategory))) {
    throw new BadRequestException("快照数据类别与清单不一致");
  }
  if (!candidate.counts || typeof candidate.counts !== "object" || Array.isArray(candidate.counts)) {
    throw new BadRequestException("快照数量清单无效");
  }
  const countKeys = Object.keys(candidate.counts as Record<string, unknown>);
  if (countKeys.length !== categories.length || countKeys.some(category => !categories.includes(category as SnapshotCategory))) {
    throw new BadRequestException("快照数量类别与清单不一致");
  }
  let total = 0;
  const snapshotUserIds = new Set((data.users?.User ?? []).map(user => user.id));
  for (const category of categories) {
    const rows = data[category];
    if (!rows || typeof rows !== "object" || Array.isArray(rows)) throw new BadRequestException(`快照缺少${snapshotCategoryLabels[category]}数据`);
    const allowed = new Set(categoryModels[category]);
    for (const [model, values] of Object.entries(rows)) {
      if (!allowed.has(model) || !Array.isArray(values) || values.some(row => !row || typeof row !== "object" || Array.isArray(row))) {
        throw new BadRequestException("快照包含无效数据模型");
      }
      const primaryKey = primaryFields(model);
      const fieldMap = new Map(modelInfo(model).fields.map(field => [field.name, field]));
      for (const row of values) {
        if (Object.keys(row).some(field => {
          const info = fieldMap.get(field);
          return !info || (info.kind !== "scalar" && info.kind !== "enum");
        })) throw new BadRequestException(`${model} 包含未知或非标量字段`);
        if (model === "User" && (typeof row.phone !== "string" || !row.phone.trim())) {
          throw new BadRequestException("用户快照只允许包含有效手机号账号");
        }
        if (category === "users" && row.ownerId !== null && row.ownerId !== undefined && !snapshotUserIds.has(row.ownerId)) {
          throw new BadRequestException(`${model} 不属于快照内的用户`);
        }
        if (model === "User" && !categories.includes("users")) throw new BadRequestException("用户数据类别无效");
        if (model === "Ingredient" || model === "Unit") {
          const isPersonal = row.ownerId !== null && row.ownerId !== undefined;
          if ((category === "users") !== isPersonal && !(model === "Ingredient" && category === "systemIngredients" && !isPersonal)) {
            throw new BadRequestException(`${model} 所属类别与记录归属不一致`);
          }
          if (category === "users" && isPersonal && !snapshotUserIds.has(row.ownerId)) {
            throw new BadRequestException(`${model} 不属于快照内的用户`);
          }
        }
        if (model === "Recipe" && ((category === "recipes") !== (row.isInspiration === true))) {
          throw new BadRequestException("Recipe 所属类别与记录类型不一致");
        }
      }
      const keys = values.map(row => keyOf(model, row));
      if (keys.includes(JSON.stringify(primaryKey.map(() => undefined))) || new Set(keys).size !== keys.length) {
        throw new BadRequestException(`${model} 存在缺失主键或重复记录`);
      }
      total += values.length;
    }
    const categoryCount = candidate.counts as Record<string, unknown>;
    const actualCount = Object.values(rows).reduce((sum, values) => sum + values.length, 0);
    if (categoryCount[category] !== actualCount) throw new BadRequestException(`${snapshotCategoryLabels[category]}数量与快照清单不一致`);
  }
  if (total > 200_000) throw new BadRequestException("快照记录数超过 200000 条");
  if (!Array.isArray(candidate.assets) || candidate.assets.some(asset => {
    if (!asset || typeof asset !== "object" || Array.isArray(asset)) return true;
    const item = asset as Record<string, unknown>;
    return typeof item.path !== "string" || !/^assets\/[a-f0-9]{64}$/u.test(item.path)
      || typeof item.sha256 !== "string" || !/^[a-f0-9]{64}$/u.test(item.sha256)
      || typeof item.sourceKey !== "string" || !item.sourceKey.startsWith("uploads/") || item.sourceKey.includes("..") || item.sourceKey.includes("\\")
      || typeof item.contentType !== "string" || !item.contentType.startsWith("image/")
      || !Number.isSafeInteger(item.size) || Number(item.size) < 0 || Number(item.size) > 100 * 1024 * 1024
      || !Array.isArray(item.references) || item.references.some(reference => typeof reference !== "string");
  })) throw new BadRequestException("快照图片清单无效");
  return candidate as unknown as SnapshotDocument;
}

export function snapshotCategoryOfModel(model: string): SnapshotCategory | "unknown" {
  return modelCategory[model] ?? "unknown";
}
