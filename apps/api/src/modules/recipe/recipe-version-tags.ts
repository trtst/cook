import type {
  IngredientProteinType as DbIngredientProteinType,
  Prisma,
  RecipeVersionTagCode,
  RecipeVersionTagSource
} from "@prisma/client";
import type { RecipeContentSnapshot, RecipeProteinType, UUID } from "../../contracts/types";

type RecipeVersionTagRow = {
  tagCode: RecipeVersionTagCode;
  tagValue: string;
  source: RecipeVersionTagSource;
  confidence?: Prisma.Decimal | number | string | null;
  sortOrder?: number | null;
  isLocked?: boolean;
};

type RecipeVersionTagSnapshot = {
  dishRoles: Array<"MAIN" | "VEGETABLE" | "SOUP" | "STAPLE">;
  mealTypes: Array<"BREAKFAST" | "LUNCH" | "DINNER">;
  mainProteinType: RecipeProteinType | null;
  primaryIngredientIds: UUID[];
  flavorProfile: string[];
  spiceLevel: "NONE" | "MILD" | "MEDIUM" | "HOT" | null;
};

type IngredientTagFact = {
  id: UUID;
  proteinType: DbIngredientProteinType | null;
  isStaple: boolean;
  isSpicyIngredient: boolean;
  aliases: string[];
};

function normalizeNameKey(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "");
}

function dedupeStrings(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function mapIngredientProteinType(value: DbIngredientProteinType | null): RecipeProteinType | null {
  switch (value) {
    case "PORK":
    case "CHICKEN":
    case "BEEF":
    case "LAMB":
    case "DUCK":
    case "NONE":
      return value;
    case "SEAFOOD":
      return "FISH";
    case "EGG":
    case "TOFU":
      return "NONE";
    default:
      return null;
  }
}

function resolvePrimaryIngredientIds(
  ingredientIds: UUID[],
  ingredientFacts: Map<UUID, IngredientTagFact>
) {
  const proteinIds = ingredientIds.filter(id => {
    const proteinType = mapIngredientProteinType(ingredientFacts.get(id)?.proteinType ?? null);
    return Boolean(proteinType) && proteinType !== "NONE";
  });
  if (proteinIds.length) return proteinIds.slice(0, 3);
  return ingredientIds.slice(0, 3);
}

function pushTag(
  rows: RecipeVersionTagRow[],
  tagCode: RecipeVersionTagRow["tagCode"],
  tagValue: string,
  sortOrder?: number | null,
  confidence: number = 0.75
) {
  if (!tagValue) return;
  rows.push({
    tagCode,
    tagValue,
    source: "AUTO",
    confidence,
    sortOrder: sortOrder ?? null,
    isLocked: false
  });
}

export function inferRecipeVersionTagSnapshot(
  content: RecipeContentSnapshot,
  ingredientFacts: Map<UUID, IngredientTagFact> = new Map()
): RecipeVersionTagSnapshot {
  const text = `${content.name} ${content.story ?? ""} ${content.ingredients.map(item => item.ingredientName).join(" ")} ${content.steps.map(item => item.text).join(" ")}`;
  const ingredientIds = content.ingredients
    .map(item => item.ingredientId ?? null)
    .filter((item): item is UUID => typeof item === "number" && item > 0);
  const normalizedNames = content.ingredients.map(item => normalizeNameKey(item.ingredientName));

  const mealTypes: RecipeVersionTagSnapshot["mealTypes"] =
    /燕麦|三明治|吐司|面包|包子|馒头|豆浆|牛奶|酸奶|煎蛋|水煮蛋|早餐/.test(text)
      ? ["BREAKFAST"]
      : ["LUNCH", "DINNER"];

  let mainProteinType: RecipeVersionTagSnapshot["mainProteinType"] = null;
  for (const ingredientId of ingredientIds) {
    const mapped = mapIngredientProteinType(ingredientFacts.get(ingredientId)?.proteinType ?? null);
    if (mapped) {
      mainProteinType = mapped;
      break;
    }
  }
  if (!mainProteinType) {
    if (/(牛肉|肥牛|牛腩|牛排)/.test(text)) mainProteinType = "BEEF";
    else if (/(羊肉|羊排|羊蝎子)/.test(text)) mainProteinType = "LAMB";
    else if (/(鸡肉|鸡翅|鸡腿|鸡胸|鸡丁)/.test(text)) mainProteinType = "CHICKEN";
    else if (/(鸭肉|鸭腿|鸭翅|鸭血|烤鸭)/.test(text)) mainProteinType = "DUCK";
    else if (/(鱼|虾|蟹|贝|蛤|蚝|海鲜)/.test(text)) mainProteinType = "FISH";
    else if (/(猪肉|排骨|五花肉|里脊|肉末|肉丝|肉片|腊肠)/.test(text)) mainProteinType = "PORK";
    else if (/(鸡蛋|豆腐|豆皮|腐竹|豆干)/.test(text)) mainProteinType = "NONE";
  }

  const dishRoles = new Set<RecipeVersionTagSnapshot["dishRoles"][number]>();
  if (/(汤|羹|汤面|汤粉|粥)/.test(text)) dishRoles.add("SOUP");
  const hasStapleIngredient = ingredientIds.some(id => ingredientFacts.get(id)?.isStaple);
  if (hasStapleIngredient || /(米饭|炒饭|盖饭|焖饭|饭团|面条|拌面|炒面|意面|馒头|包子|花卷|饼|粥|米线|粉丝|粉条)/.test(text)) {
    dishRoles.add("STAPLE");
  }
  if (!dishRoles.size) {
    if (mainProteinType && mainProteinType !== "NONE") dishRoles.add("MAIN");
    else dishRoles.add("VEGETABLE");
  }

  const primaryIngredientIds = resolvePrimaryIngredientIds(ingredientIds, ingredientFacts);

  const flavorProfile = new Set<string>();
  if (/不辣|清淡/.test(text)) flavorProfile.add("LIGHT");
  if (/微辣/.test(text)) flavorProfile.add("MILD");
  if (/麻辣|香辣|辣椒|辣子|剁椒|小米辣/.test(text)) flavorProfile.add("SPICY");
  if (/酸|番茄|醋/.test(text)) flavorProfile.add("SOUR");
  if (/甜|可乐|糖醋|蜂蜜/.test(text)) flavorProfile.add("SWEET");

  let spiceLevel: RecipeVersionTagSnapshot["spiceLevel"] = null;
  const spicyIngredientCount = ingredientIds.filter(id => ingredientFacts.get(id)?.isSpicyIngredient).length;
  if (/重辣|麻辣|香辣|辣椒|辣子|剁椒|小米辣/.test(text) || spicyIngredientCount >= 3) spiceLevel = "HOT";
  else if (spicyIngredientCount >= 2) spiceLevel = "MEDIUM";
  else if (spicyIngredientCount >= 1) spiceLevel = "MILD";
  else if (/中辣/.test(text)) spiceLevel = "MEDIUM";
  else if (/微辣/.test(text)) spiceLevel = "MILD";
  else if (flavorProfile.has("LIGHT") || /不辣/.test(text)) spiceLevel = "NONE";

  if (!primaryIngredientIds.length && normalizedNames.some(name => /鸡蛋|豆腐|番茄|土豆|白菜|青菜|黄瓜/.test(name))) {
    // No-op fallback; keep structured matching authoritative.
  }

  return {
    dishRoles: Array.from(dishRoles),
    mealTypes,
    mainProteinType,
    primaryIngredientIds,
    flavorProfile: dedupeStrings(Array.from(flavorProfile)),
    spiceLevel
  };
}

export function buildAutoRecipeVersionTags(
  content: RecipeContentSnapshot,
  ingredientFacts: Map<UUID, IngredientTagFact> = new Map()
): RecipeVersionTagRow[] {
  const snapshot = inferRecipeVersionTagSnapshot(content, ingredientFacts);
  const rows: RecipeVersionTagRow[] = [];

  snapshot.dishRoles.forEach((value, index) => pushTag(rows, "DISH_ROLE", value, index, 0.82));
  snapshot.mealTypes.forEach((value, index) => pushTag(rows, "MEAL_TYPE", value, index, 0.78));
  snapshot.primaryIngredientIds.forEach((value, index) =>
    pushTag(rows, "PRIMARY_INGREDIENT", String(value), index, 0.9)
  );
  snapshot.flavorProfile.forEach((value, index) => pushTag(rows, "FLAVOR_PROFILE", value, index, 0.62));
  if (snapshot.mainProteinType) pushTag(rows, "MAIN_PROTEIN_TYPE", snapshot.mainProteinType, null, 0.86);
  if (snapshot.spiceLevel) pushTag(rows, "SPICE_LEVEL", snapshot.spiceLevel, null, 0.7);

  return rows;
}

export async function replaceAutoRecipeVersionTags(
  tx: Prisma.TransactionClient,
  recipeVersionId: UUID,
  content: RecipeContentSnapshot
) {
  await tx.recipeVersionTag.deleteMany({
    where: {
      recipeVersionId,
      source: "AUTO"
    }
  });

  const ingredientIds = Array.from(
    new Set(content.ingredients.map(item => item.ingredientId).filter((item): item is UUID => typeof item === "number" && item > 0))
  );
  const ingredientFacts =
    ingredientIds.length === 0
      ? new Map<UUID, IngredientTagFact>()
      : new Map(
          (
            await tx.ingredient.findMany({
              where: { id: { in: ingredientIds } },
              select: {
                id: true,
                proteinType: true,
                isStaple: true,
                isSpicyIngredient: true,
                aliases: true
              }
            })
          ).map(item => [item.id, item])
        );

  const rows = buildAutoRecipeVersionTags(content, ingredientFacts);
  if (!rows.length) return;

  await tx.recipeVersionTag.createMany({
    data: rows.map(item => ({
      recipeVersionId,
      tagCode: item.tagCode,
      tagValue: item.tagValue,
      source: item.source,
      confidence: item.confidence ?? null,
      sortOrder: item.sortOrder ?? null,
      isLocked: item.isLocked ?? false
    }))
  });
}
