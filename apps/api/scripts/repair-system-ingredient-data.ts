import { readFileSync, writeFileSync } from "node:fs";
import { IngredientNutrientMappingStatus, IngredientProteinType, Prisma, PrismaClient } from "@prisma/client";
import { loadLocalEnv } from "../src/common/load-env";
import { buildSearchKey } from "../src/modules/recipe/recipe-content";
import {
  assertRecipeMigrationTarget,
  parseRecipeMigrationTarget,
  recipeMigrationFingerprint
} from "./recipe-migration-target";

type FieldChange = {
  ingredientId: number;
  ingredientName: string;
  field: string;
  before: unknown;
  after: unknown;
  certainty: "CONFIRMED" | "GUESSED";
  basis: string;
};

const sourceVersion = "2026-08-22-primary-subset-v1";
const categoryFixes = new Map([["香葱", "PRODUCE"]]);
const guessedDefaultUnits = new Map<string, string>([
  ["花生米", "克"], ["盐", "克"], ["蒜", "瓣"], ["白胡椒粉", "克"],
  ["熟白芝麻", "克"], ["葱花", "克"], ["姜蒜", "克"], ["淀粉水", "毫升"],
  ["葱丝", "克"], ["姜丝", "克"], ["姜末", "克"], ["黑胡椒", "克"],
  ["水淀粉", "毫升"], ["玉子豆腐", "盒"], ["红油辣椒", "克"], ["藕片", "克"],
  ["鸡", "个"], ["鲜百合", "克"], ["胡椒粉", "克"], ["凤爪", "个"],
  ["青红彩椒", "个"], ["蒜头", "个"], ["甜玉米", "个"], ["黑胡椒粉", "克"]
]);

const stapleExceptions = new Set([
  "淀粉", "土豆淀粉", "红薯淀粉", "豌豆淀粉", "绿豆淀粉", "小麦淀粉", "大米淀粉", "玉米淀粉",
  "煎炸粉", "藕粉", "桂花藕粉", "魔芋精粉", "魔芋结", "芋圆", "珍珠粉圆", "小圆子", "水面筋", "花生米", "熟白芝麻"
]);

const spicyExceptions = new Set(["青椒", "红椒", "韩式泡菜", "咖喱粉", "咖喱酱", "冬阴功酱", "XO酱"]);

function inferProteinType(name: string, categoryCode: string): IngredientProteinType {
  if (/(海带|紫菜|裙带菜|海白菜|海苔|发菜|海茸)/.test(name)) return "NONE";
  if (categoryCode !== "SEAFOOD" && /(素鸡|素火腿|素大肠|素虾|素肉|素肠|豆腐|豆干|豆皮|豆浆|豆奶|腐乳|腐竹|枝竹|千张|豆泡|香干|熏干|卤干|酱油干|臭干|素什锦|豆肝尖|油面筋|烤麸|面筋|黄豆|黑豆|绿豆|红豆|赤小豆|蚕豆|木豆|眉豆|荆豆|鹰嘴豆|豌豆|毛豆|花生|芝麻|葵花籽|瓜子|核桃|杏仁|腰果|榛子|松子|开心果|莲子|芡实)/.test(name)) return "PLANT";
  if (categoryCode === "MEAT_POULTRY_EGG" || categoryCode === "DRIED_PRESERVED") {
    if (/(鸡蛋|鸭蛋|鹅蛋|鹌鹑蛋|皮蛋|咸蛋|松花蛋|蛋清|蛋黄)/.test(name)) return "EGG";
    if (/(牛|肥牛)/.test(name)) return "BEEF";
    if (/(羊)/.test(name)) return "LAMB";
    if (/(鸭)/.test(name)) return "DUCK";
    if (/(鸡)/.test(name)) return "CHICKEN";
    if (/(猪|排骨|里脊肉|肥肠|肉末|肉沫|肉丝|肉片|肉丸|腊肠|香肠|腊肉|咸肉|酱肉|火腿|培根|瘦肉)/.test(name)) return "PORK";
  }
  if (categoryCode === "SEAFOOD" || categoryCode === "DRIED_PRESERVED") {
    if (/(虾|蟹|贝|蛤|蚝|鲍鱼|鱿鱼|墨鱼|章鱼|海参|海蜇|海鲜)/.test(name)) return "SEAFOOD";
    if (/(鱼|腊鱼|咸鱼|鱼干|鳗鲡)/.test(name)) return "FISH";
    if (categoryCode === "SEAFOOD") return "SEAFOOD";
  }
  return "NONE";
}

function inferStaple(name: string, categoryCode: string) {
  if (name === "土豆") return true;
  if (categoryCode !== "GRAINS_STAPLES") return false;
  return !stapleExceptions.has(name);
}

function inferSpicy(name: string) {
  if (spicyExceptions.has(name)) return false;
  return /(辣椒|小米辣|小米椒|尖椒|杭椒|线椒|朝天椒|二荆条|指天椒|七星椒|子弹头辣椒|螺丝椒|剁椒|泡椒|辣酱|辣椒面|辣椒粉|辣椒碎|辣椒段|辣椒丝|辣椒油|辣椒红油|红油辣椒|油泼辣子|糍粑辣椒|糊辣椒|糟辣椒|花椒|胡椒|芥末|山葵|麻辣)/.test(name);
}

function normalized(value: string) {
  return buildSearchKey(value).replace(/[［【]/g, "[").replace(/[］】]/g, "]");
}

function getAliasCandidates(name: string, nutrientNames: string[]) {
  const aliases = new Set<string>();
  for (const foodName of nutrientNames) {
    for (const match of foodName.matchAll(/[\[［【]([^\]］】]+)[\]］】]/g)) {
      for (const alias of match[1].split(/[、，,]/).map(value => value.trim())) {
        if (alias && normalized(alias) !== normalized(name)) aliases.add(alias);
      }
    }
  }
  return [...aliases];
}

function readFlag(name: string) {
  return process.argv.find(argument => argument.startsWith(`${name}=`))?.split("=").slice(1).join("=") ?? null;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const reportPath = readFlag("--report");
  const approvedReportPath = readFlag("--approved-report");
  loadLocalEnv();
  const target = parseRecipeMigrationTarget(process.argv);
  assertRecipeMigrationTarget(target, apply, process.env, process.argv);
  const targetFingerprint = recipeMigrationFingerprint(process.env);
  const prisma = new PrismaClient();
  try {
    const rows = await prisma.ingredient.findMany({
      where: { ownerId: null },
      orderBy: { id: "asc" },
      include: {
        category: true,
        defaultUnit: true,
        nutrientMappings: { include: { nutrientFood: true } }
      }
    });
    const categories = await prisma.ingredientCategory.findMany({ select: { id: true, code: true } });
    const categoryIds = new Map(categories.map(category => [category.code, category.id]));
    const units = await prisma.unit.findMany({ where: { ownerId: null }, select: { id: true, name: true } });
    const unitIds = new Map(units.map(unit => [unit.name, unit.id]));
    const nutrientFoods = await prisma.nutrientFood.findMany({ where: { sourceVersion }, select: { id: true, name: true, sourceFoodCode: true } });
    const changes: FieldChange[] = [];
    const proposed = new Map<number, Prisma.IngredientUpdateInput>();
    const aliasOwners = new Map<string, Set<number>>();
    for (const row of rows) {
      for (const token of [row.name, ...row.aliases]) {
        const key = normalized(token);
        const owners = aliasOwners.get(key) ?? new Set<number>();
        owners.add(row.id);
        aliasOwners.set(key, owners);
      }
    }

    for (const row of rows) {
      const data: Prisma.IngredientUpdateManyMutationInput = {};
      const addChange = (field: string, before: unknown, after: unknown, certainty: FieldChange["certainty"], basis: string) => {
        if (JSON.stringify(before) === JSON.stringify(after)) return;
        changes.push({ ingredientId: row.id, ingredientName: row.name, field, before, after, certainty, basis });
      };

      const categoryCode = categoryFixes.get(row.name);
      if (categoryCode && row.category.code !== categoryCode) {
        const nextCategoryId = categoryIds.get(categoryCode);
        if (nextCategoryId) {
          data.categoryId = nextCategoryId;
          addChange("categoryCode", row.category.code, categoryCode, "GUESSED", "鲜香葱按食材本体归入蔬果菌菇；不是加工调味料");
        }
      }

      const inferredProteinType = inferProteinType(row.name, row.category.code);
      const existingTypeIsClear = row.proteinType !== null && inferredProteinType === "NONE";
      const proteinType = existingTypeIsClear ? row.proteinType! : inferredProteinType;
      if (row.proteinType !== proteinType) {
        data.proteinType = proteinType;
        addChange("proteinType", row.proteinType, proteinType, "GUESSED", "按名称和食材分类匹配主蛋白枚举；保留已有明确类型，NONE 表示当前枚举无对应类型");
      }

      const isStaple = inferStaple(row.name, row.category.code);
      if (row.isStaple !== isStaple) {
        data.isStaple = isStaple;
        addChange("isStaple", row.isStaple, isStaple, "GUESSED", "按日常主食定义和米面杂粮分类逐项判断；淀粉、粉圆等非主食排除");
      }

      const isSpicyIngredient = inferSpicy(row.name);
      if (row.isSpicyIngredient !== isSpicyIngredient) {
        data.isSpicyIngredient = isSpicyIngredient;
        addChange("isSpicyIngredient", row.isSpicyIngredient, isSpicyIngredient, "GUESSED", "按名称判断是否主要提供辣、麻或辛辣刺激；普通青红椒、咖喱及复合酱料不默认算辣味驱动");
      }

      if (!row.defaultUnitId) {
        const unitName = guessedDefaultUnits.get(row.name);
        const unitId = unitName ? unitIds.get(unitName) : undefined;
        if (unitName && unitId) {
          data.defaultUnitId = unitId;
          addChange("defaultUnit", null, unitName, "GUESSED", "按食材形态和常见计量习惯补默认单位");
        }
      }

      const candidates = getAliasCandidates(row.name, row.nutrientMappings.map(mapping => mapping.nutrientFood?.name ?? ""));
      const nextAliases = [...row.aliases];
      const added: string[] = [];
      for (const alias of candidates) {
        const key = normalized(alias);
        const owners = aliasOwners.get(key);
        if ((owners && [...owners].some(id => id !== row.id)) || nextAliases.some(value => normalized(value) === key)) continue;
        nextAliases.push(alias);
        added.push(alias);
        const nextOwners = owners ?? new Set<number>();
        nextOwners.add(row.id);
        aliasOwners.set(key, nextOwners);
      }
      if (added.length) {
        data.aliases = nextAliases;
        addChange("aliases", row.aliases, nextAliases, "GUESSED", "仅从已确认营养食品名的括号同名/别名提取，并排除与其他食材名称或别名冲突的候选");
      }

      if (Object.keys(data).length) proposed.set(row.id, data);
    }

    const byNormalizedFoodName = new Map<string, typeof nutrientFoods>();
    for (const food of nutrientFoods) {
      const key = normalized(food.name);
      byNormalizedFoodName.set(key, [...(byNormalizedFoodName.get(key) ?? []), food]);
    }
    const exactNutritionCandidates = rows.flatMap(row => {
      if (row.nutrientMappings.length) return [];
      const matches = byNormalizedFoodName.get(normalized(row.name)) ?? [];
      return matches.length === 1 ? [{ ingredientId: row.id, ingredientName: row.name, nutrientFoodId: matches[0].id, nutrientFoodName: matches[0].name, sourceFoodCode: matches[0].sourceFoodCode }] : [];
    });

    const report = {
      schemaVersion: "system-ingredient-repair.v1",
      mode: apply ? "apply" : "dry-run",
      target,
      targetFingerprint,
      generatedAt: new Date().toISOString(),
      totalSystemIngredients: rows.length,
      statusCounts: [...rows.reduce((counts, row) => {
        counts.set(row.status, (counts.get(row.status) ?? 0) + 1);
        return counts;
      }, new Map<string, number>())].map(([status, count]) => ({ status, count })),
      changedIngredientCount: proposed.size,
      changeCount: changes.length,
      guessedChanges: changes,
      exactNutritionCandidates,
      exactNutritionCreated: apply ? exactNutritionCandidates.length : 0,
      issues: {
        unclassifiedCount: rows.filter(row => row.category.code === "UNCLASSIFIED").length,
        activeWithoutDefaultUnit: rows.filter(row => row.status === "ACTIVE" && !row.defaultUnitId).map(row => ({ id: row.id, name: row.name })),
        unresolvedMissingDefaultUnit: rows.filter(row => !row.defaultUnitId && !guessedDefaultUnits.has(row.name)).map(row => ({ id: row.id, name: row.name, status: row.status })),
        existingNameAliasConflicts: rows.flatMap(row => row.aliases.filter(alias => rows.some(other => other.id !== row.id && normalized(other.name) === normalized(alias))).map(alias => ({ id: row.id, name: row.name, alias }))),
        duplicateNames: rows.flatMap(row => rows.filter(other => other.id !== row.id && normalized(other.name) === normalized(row.name)).map(other => ({ id: row.id, name: row.name, status: row.status, duplicateId: other.id, duplicateStatus: other.status })))
      }
    };

    if (apply) {
      if (!approvedReportPath) throw new Error("线上/测试写入必须提供 --approved-report=<dry-run 清单路径>");
      let approved: Record<string, unknown>;
      try {
        approved = JSON.parse(readFileSync(approvedReportPath, "utf8")) as Record<string, unknown>;
      } catch {
        throw new Error("无法读取已审阅的 dry-run 清单，拒绝写入");
      }
      if (
        approved.schemaVersion !== report.schemaVersion ||
        approved.mode !== "dry-run" ||
        approved.target !== target ||
        approved.targetFingerprint !== targetFingerprint ||
        approved.totalSystemIngredients !== report.totalSystemIngredients ||
        JSON.stringify(approved.guessedChanges) !== JSON.stringify(report.guessedChanges) ||
        JSON.stringify(approved.exactNutritionCandidates) !== JSON.stringify(report.exactNutritionCandidates)
      ) {
        throw new Error("当前数据库与已审阅清单不一致，拒绝写入；请重新生成并审阅 dry-run 清单");
      }
      await prisma.$transaction(async tx => {
        for (const [id, data] of proposed) {
          const result = await tx.ingredient.updateMany({
            where: { id, ownerId: null, version: rows.find(row => row.id === id)!.version },
            data: { ...data, version: { increment: 1 } }
          });
          if (result.count !== 1) throw new Error(`食材 ${id} 在写入前发生变化，本批事务已回滚`);
        }
        for (const item of exactNutritionCandidates) {
          await tx.ingredientNutrientMapping.create({
            data: {
              ingredientId: item.ingredientId,
              nutrientFoodId: item.nutrientFoodId,
              status: IngredientNutrientMappingStatus.CONFIRMED,
              matchType: "EXACT_NAME",
              confidence: 1,
              sourceVersion
            }
          });
        }
      });
    }

    if (reportPath) writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    console.log(JSON.stringify({
      mode: report.mode,
      totalSystemIngredients: report.totalSystemIngredients,
      changedIngredientCount: report.changedIngredientCount,
      changeCount: report.changeCount,
      exactNutritionCandidates: exactNutritionCandidates.length,
      exactNutritionCreated: report.exactNutritionCreated,
      issueCounts: {
        unclassified: report.issues.unclassifiedCount,
        activeWithoutDefaultUnit: report.issues.activeWithoutDefaultUnit.length,
        unresolvedMissingDefaultUnit: report.issues.unresolvedMissingDefaultUnit.length,
        nameAliasConflicts: report.issues.existingNameAliasConflicts.length,
        duplicateNames: report.issues.duplicateNames.length
      },
      reportPath: reportPath ?? null
    }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
