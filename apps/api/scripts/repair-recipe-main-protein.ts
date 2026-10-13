import { Prisma, PrismaClient, type IngredientProteinType, type RecipeProteinType } from "@prisma/client";
import { loadLocalEnv } from "../src/common/load-env";
import { PrismaService } from "../src/common/prisma.service";
import { HomeTopicStatsService } from "../src/modules/home/home-topic-stats.service";
import { versionToContent } from "../src/modules/recipe/recipe-content";
import { inferIngredientTagFacts } from "../src/modules/recipe/ingredient-tag-facts";
import { publicInspirationRecipeWhere } from "../src/modules/recipe/public-content-user-pool";

loadLocalEnv();

const prisma = new PrismaClient();
const batchSize = 200;
const fishNamePattern = /(草鱼|鲤鱼|鲫鱼|带鱼|黑鱼|鲈鱼|海鲈鱼|三文鱼|鳕鱼|金枪鱼|罗非鱼|黄花鱼|黄鱼|胖头鱼|秋刀鱼|鳗鱼|鳗鲡|鲳鱼|鲢鱼|鳊鱼|鳜鱼|鲶鱼|武昌鱼|巴沙鱼|多宝鱼|石斑鱼|鲅鱼|龙利鱼|花鲢鱼)/;
const seaweedNamePattern = /(海带|紫菜|裙带菜)/;
const incidentalSeafoodPattern = /(虾皮|虾酱|海米|鱼露|鱼干)/;

type ProteinFact = {
  id: number;
  name: string;
  aliases: string[];
  proteinType: string | null;
  category: { code: string };
};

function mapIngredientProtein(fact: ProteinFact): RecipeProteinType | null {
  if (fact.category.code === "MEAT_POULTRY_EGG") {
    if (["PORK", "CHICKEN", "BEEF", "LAMB", "DUCK", "EGG"].includes(fact.proteinType ?? "")) {
      return fact.proteinType as RecipeProteinType;
    }
  }
  if (fact.category.code === "SEAFOOD" && (seaweedNamePattern.test(fact.name) || incidentalSeafoodPattern.test(fact.name))) return null;
  if (fact.category.code === "SEAFOOD" && ["FISH", "SEAFOOD"].includes(fact.proteinType ?? "")) {
    return fact.proteinType as RecipeProteinType;
  }
  if (fact.category.code === "SOY_DAIRY" && fact.proteinType === "PLANT") return "PLANT";
  return null;
}

function titleProteinMatches(title: string, availableTypes: Set<RecipeProteinType>) {
  const matches: Array<{ index: number; type: RecipeProteinType }> = [];
  const patterns: Array<[RecipeProteinType, RegExp]> = [
    ["BEEF", /牛肉|牛腩|肥牛|牛排|牛里脊/g],
    ["LAMB", /羊肉|羊排|羊蝎子/g],
    ["CHICKEN", /鸡肉|鸡翅|鸡腿|鸡胸|鸡丁/g],
    ["DUCK", /鸭肉|鸭腿|鸭翅|烤鸭/g],
    ["PORK", /猪肉|排骨|五花肉|猪里脊|肉末|肉丝|肉片|腊肠/g],
    ["FISH", new RegExp(fishNamePattern.source, "g")],
    ["SEAFOOD", /虾|蟹|贝|蛤|蚝|鲍鱼|鱿鱼|墨鱼|海鲜/g],
    ["EGG", /鸡蛋|鸭蛋|鹅蛋|鹌鹑蛋|皮蛋|咸蛋|松花蛋|蛋/g],
    ["PLANT", /豆腐|豆干|豆皮|腐竹|豆浆|千张/g]
  ];
  for (const [type, pattern] of patterns) {
    if (!availableTypes.has(type)) continue;
    for (const match of title.matchAll(pattern)) matches.push({ index: match.index ?? 0, type });
  }
  return matches.sort((left, right) => left.index - right.index);
}

function classifyVersion(content: ReturnType<typeof versionToContent>, facts: Map<number, ProteinFact>) {
  let hasUnlinkedIngredient = false;
  let hasUnclassifiedProteinIngredient = false;
  const proteinTypes = new Set<RecipeProteinType>();
  for (const item of content.ingredients) {
    const id = item.ingredientId;
    if (!id) {
      hasUnlinkedIngredient = true;
      continue;
    }
    const fact = facts.get(id);
    if (!fact) {
      hasUnlinkedIngredient = true;
      continue;
    }
    const type = mapIngredientProtein(fact);
    if (type) proteinTypes.add(type);
    if (
      !type &&
      !seaweedNamePattern.test(fact.name) &&
      !incidentalSeafoodPattern.test(fact.name) &&
      ["MEAT_POULTRY_EGG", "SEAFOOD", "SOY_DAIRY"].includes(fact.category.code)
    ) {
      hasUnclassifiedProteinIngredient = true;
    }
  }
  if (hasUnlinkedIngredient) return { type: null, reason: "UNLINKED_INGREDIENT" as const };
  if (hasUnclassifiedProteinIngredient) return { type: null, reason: "UNCLASSIFIED_PROTEIN_INGREDIENT" as const };
  if (proteinTypes.size === 1) return { type: [...proteinTypes][0] as RecipeProteinType, reason: null };
  if (proteinTypes.size > 1) {
    if (/炒肉(?!丝|片|末)|烧肉|丸子/.test(content.name)) {
      const animalTypes = [...proteinTypes].filter(type => ["PORK", "CHICKEN", "BEEF", "LAMB", "DUCK"].includes(type));
      if (animalTypes.length === 1) return { type: animalTypes[0] as RecipeProteinType, reason: null };
    }
    const titleMatches = titleProteinMatches(content.name, proteinTypes);
    if (titleMatches.length) return { type: titleMatches[0]!.type, reason: null };
    return { type: null, reason: "MULTIPLE_PROTEIN_TYPES" as const };
  }
  return { type: null, reason: "NO_STRUCTURED_PROTEIN" as const };
}

function inferReferencedProteinType(item: { name: string; aliases: string[]; proteinType: string | null; category: { code: string } }) {
  const names = [item.name, ...item.aliases];
  if (item.category.code === "SEAFOOD") {
    if (names.some(name => fishNamePattern.test(name))) return "FISH";
    if (names.some(name => seaweedNamePattern.test(name) || incidentalSeafoodPattern.test(name))) return null;
    return "SEAFOOD";
  }
  if (item.category.code === "MEAT_POULTRY_EGG" || item.category.code === "SOY_DAIRY") {
    return inferIngredientTagFacts({ name: item.name, categoryCode: item.category.code, aliases: item.aliases }).proteinType;
  }
  return null;
}

async function classifyFishIngredients(apply: boolean) {
  const candidates = await prisma.ingredient.findMany({
    where: { ownerId: null, status: { in: ["ACTIVE", "PENDING"] }, category: { code: "SEAFOOD" } },
    select: { id: true, name: true, aliases: true, proteinType: true }
  });
  const matches = candidates.filter(
    item => item.proteinType !== "FISH" && [item.name, ...item.aliases].some(value => fishNamePattern.test(value))
  );
  if (apply && matches.length) {
    for (let offset = 0; offset < matches.length; offset += batchSize) {
      const batch = matches.slice(offset, offset + batchSize);
      await prisma.$transaction(
        batch.map(item =>
          prisma.ingredient.update({
            where: { id: item.id },
            data: { proteinType: "FISH", version: { increment: 1 } }
          })
        )
      );
    }
  }
  return matches;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const sampleLimit = 20;
  const admin = apply
    ? await prisma.adminAccount.findFirst({ where: { status: "ACTIVE" }, select: { id: true }, orderBy: { id: "asc" } })
    : null;
  if (apply && !admin) throw new Error("No active admin account is available to rebuild the recipe statistics snapshot");
  const fishMatches = await classifyFishIngredients(apply);
  const fishMatchIds = new Set(fishMatches.map(item => item.id));
  let cursorId = 0;
  let scanned = 0;
  let wouldChange = 0;
  let updated = 0;
  let unchanged = 0;
  let removedOther = 0;
  const repairedIngredientIds = new Set<number>();
  const activeIngredients = await prisma.ingredient.findMany({
    where: { ownerId: null, status: { in: ["ACTIVE", "PENDING"] } },
    select: { id: true, name: true, aliases: true, proteinType: true, category: { select: { code: true } } },
    orderBy: { id: "asc" }
  });
  const proteinFactUpdates = activeIngredients.flatMap(row => {
    const inferredType = inferReferencedProteinType(row);
    return inferredType && inferredType !== row.proteinType ? [{ id: row.id, proteinType: inferredType }] : [];
  });
  for (const row of proteinFactUpdates) repairedIngredientIds.add(row.id);
  if (apply) {
    for (let offset = 0; offset < proteinFactUpdates.length; offset += batchSize) {
      const batch = proteinFactUpdates.slice(offset, offset + batchSize);
      await prisma.$transaction(
        batch.map(row =>
          prisma.ingredient.update({
            where: { id: row.id },
            data: { proteinType: row.proteinType as IngredientProteinType, version: { increment: 1 } }
          })
        )
      );
    }
  }
  const reasons: Record<string, number> = {};
  const transitions: Record<string, number> = {};
  const samples: Array<{
    recipeId: number;
    versionId: number;
    name: string;
    from: string[];
    to: string | null;
    reason: string | null;
    ingredients: Array<{ ingredientId: number | null; name: string; proteinType: string | null; category: string | null }>;
  }> = [];

  while (true) {
    const recipes = await prisma.recipe.findMany({
      where: { ...publicInspirationRecipeWhere("ACTIVE"), id: { gt: cursorId } },
      orderBy: { id: "asc" },
      take: batchSize,
      select: {
        id: true,
        currentVersion: {
          select: {
            id: true,
            name: true,
            story: true,
            baseServings: true,
            difficulty: true,
            duration: true,
            estimatedCalories: true,
            tips: true,
            keywordsJson: true,
            toolsJson: true,
            ingredientsJson: true,
            stepsJson: true,
            imagesJson: true,
            searchText: true,
            contentSizeBytes: true,
            versionTags: {
              where: { tagCode: "MAIN_PROTEIN_TYPE" },
              select: { id: true, tagValue: true, source: true, status: true, confidence: true, sortOrder: true, isLocked: true }
            }
          }
        }
      }
    });
    if (!recipes.length) break;
    cursorId = recipes[recipes.length - 1]!.id;
    scanned += recipes.length;

    const ingredientIds = Array.from(
      new Set(
        recipes.flatMap(recipe => {
          const content = versionToContent(recipe.currentVersion);
          return content.ingredients.flatMap(item => item.ingredientId ? [item.ingredientId] : []);
        })
      )
    );
    const facts = new Map<number, ProteinFact>();
    for (let offset = 0; offset < ingredientIds.length; offset += 500) {
      const rows = await prisma.ingredient.findMany({
        where: { id: { in: ingredientIds.slice(offset, offset + 500) } },
        select: { id: true, ownerId: true, status: true, name: true, aliases: true, proteinType: true, category: { select: { code: true } } }
      });
      for (const row of rows) {
        const inferredType = inferReferencedProteinType(row);
        const nextType = inferredType ?? row.proteinType;
        const mayRepair = row.ownerId === null && ["ACTIVE", "PENDING"].includes(row.status) && inferredType !== null && inferredType !== row.proteinType;
        if (mayRepair) {
          repairedIngredientIds.add(row.id);
          if (apply) {
            await prisma.ingredient.update({ where: { id: row.id }, data: { proteinType: inferredType, version: { increment: 1 } } });
          }
        }
        const nonMainSeafood =
          row.category.code === "SEAFOOD" && [row.name, ...row.aliases].some(name => seaweedNamePattern.test(name) || incidentalSeafoodPattern.test(name));
        facts.set(row.id, {
          ...row,
          proteinType: nonMainSeafood ? null : fishMatchIds.has(row.id) ? "FISH" : mayRepair ? inferredType : nextType
        } as ProteinFact);
      }
    }

    for (const recipe of recipes) {
      const version = recipe.currentVersion;
      const content = versionToContent(version);
      const currentTags = version.versionTags;
      const inferred = classifyVersion(content, facts);
      const currentValues = currentTags.map(item => item.tagValue);
      const hasLegacyOther = currentValues.includes("OTHER");
      reasons[inferred.reason ?? "DETERMINISTIC"] = (reasons[inferred.reason ?? "DETERMINISTIC"] ?? 0) + 1;

      if (inferred.type && currentTags.length === 1 && currentTags[0]?.tagValue === inferred.type) {
        unchanged += 1;
        continue;
      }
      if (!inferred.type && !hasLegacyOther) {
        unchanged += 1;
        continue;
      }
      wouldChange += 1;
      const transition = `${currentValues.join(",") || "MISSING"}->${inferred.type ?? "MISSING"}`;
      transitions[transition] = (transitions[transition] ?? 0) + 1;
      if (samples.length < sampleLimit) {
        samples.push({
          recipeId: recipe.id,
          versionId: version.id,
          name: version.name,
          from: currentValues,
          to: inferred.type,
          reason: inferred.reason,
          ingredients: content.ingredients.flatMap(item => {
            const fact = item.ingredientId ? facts.get(item.ingredientId) : undefined;
            if (!fact || (!fact.proteinType && fact.category.code !== "MEAT_POULTRY_EGG")) return [];
            return [{ ingredientId: item.ingredientId ?? null, name: item.ingredientName, proteinType: fact.proteinType ?? null, category: fact.category.code }];
          })
        });
      }
      if (!apply) continue;

      await prisma.$transaction(async tx => {
        await tx.recipeVersionTag.deleteMany({ where: { recipeVersionId: version.id, tagCode: "MAIN_PROTEIN_TYPE" } });
        if (inferred.type) {
          await tx.recipeVersionTag.create({
            data: {
              recipeVersionId: version.id,
              tagCode: "MAIN_PROTEIN_TYPE",
              tagValue: inferred.type,
              source: "AUTO",
              status: "CONFIRMED",
              confidence: new Prisma.Decimal(1),
              isLocked: false
            }
          });
        }
      });
      updated += 1;
      if (hasLegacyOther && !inferred.type) removedOther += 1;
    }
  }

  const changedData = fishMatches.length > 0 || repairedIngredientIds.size > 0 || updated > 0;
  if (apply && changedData) {
    await prisma.homeTopicMenuCheckSnapshot.deleteMany();
    await prisma.auditEvent.create({
      data: {
        actorType: "ADMIN",
        actorAdminId: admin!.id,
        action: "RECIPE_MAIN_PROTEIN_BATCH_REPAIRED",
        objectType: "RECIPE_MAIN_PROTEIN",
        objectId: 1,
        payload: {
          fishIngredientCount: fishMatches.length,
          repairedIngredientCount: repairedIngredientIds.size,
          repairedRecipeVersionCount: updated,
          removedOtherCount: removedOther
        }
      }
    });
    const statsService = new HomeTopicStatsService(prisma as unknown as PrismaService);
    const rebuilt = await statsService.rebuild(admin!.id, String(Date.now()));
    console.log(JSON.stringify({ refreshedLibrarySnapshot: rebuilt.snapshot }, null, 2));
  }

  console.log(JSON.stringify({
    mode: apply ? "apply" : "dry-run",
    publicInspirationRecipes: scanned,
    fishIngredientMatches: fishMatches.length,
    repairedIngredientProteinFacts: repairedIngredientIds.size,
    proteinFactUpdates: proteinFactUpdates.length,
    fishIngredientSamples: fishMatches.slice(0, sampleLimit).map(item => ({ id: item.id, name: item.name })),
    changedRecipeVersions: apply ? updated : wouldChange,
    unchanged,
    removedUnmappableOTHER: removedOther,
    classificationReasons: reasons,
    transitions,
    samples,
    invalidatedWeeklyMenuChecks: apply && changedData,
    librarySnapshotRebuilt: apply && changedData
  }, null, 2));
}

main()
  .catch(error => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
