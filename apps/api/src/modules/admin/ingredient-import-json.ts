import type { RecipeImportIssue } from "../../contracts/types";

export interface IngredientImportJsonSource {
  sourcePath: string;
  jsonText: string;
}

export interface IngredientImportNutritionDraft {
  sourceVersion: string;
  foodCode: string;
  foodName: string;
  matchType: "EXACT_NAME" | "ALIAS" | "REPRESENTATIVE" | "LEAN_REPRESENTATIVE" | "MANUAL" | "REVIEW_NEEDED";
  confidence: number;
  conversions: Array<{ unitName: string; gramsPerUnit: number }>;
}

export interface IngredientImportItemDraft {
  sourcePath: string;
  sourceIndex: number;
  name: string;
  aliases: string[];
  categoryCode: string | null;
  defaultUnitName: string | null;
  proteinType: "PORK" | "CHICKEN" | "BEEF" | "LAMB" | "DUCK" | "SEAFOOD" | "EGG" | "TOFU" | "NONE" | null;
  isStaple: boolean;
  isSpicyIngredient: boolean;
  imageUrl: string | null;
  nutrition: IngredientImportNutritionDraft | null;
  errorItems: RecipeImportIssue[];
  warnItems: RecipeImportIssue[];
}

export interface IngredientImportJsonResult {
  items: IngredientImportItemDraft[];
  errorItems: RecipeImportIssue[];
  warnItems: RecipeImportIssue[];
}

const rootKeys = new Set(["schemaVersion", "ingredients"]);
const ingredientKeys = new Set([
  "name",
  "aliases",
  "categoryCode",
  "defaultUnitName",
  "proteinType",
  "isStaple",
  "isSpicyIngredient",
  "imageUrl",
  "nutrition"
]);
const nutritionKeys = new Set(["sourceVersion", "foodCode", "foodName", "matchType", "confidence", "conversions"]);
const conversionKeys = new Set(["unitName", "gramsPerUnit"]);
const categoryCodes = new Set([
  "PRODUCE",
  "MEAT_POULTRY_EGG",
  "SEAFOOD",
  "SOY_DAIRY",
  "GRAINS_STAPLES",
  "SEASONING",
  "DRIED_PRESERVED",
  "BEVERAGE_ALCOHOL"
]);
const proteinTypes = new Set(["PORK", "CHICKEN", "BEEF", "LAMB", "DUCK", "SEAFOOD", "EGG", "TOFU", "NONE"]);
const matchTypes = new Set(["EXACT_NAME", "ALIAS", "REPRESENTATIVE", "LEAN_REPRESENTATIVE", "MANUAL", "REVIEW_NEEDED"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOwn(value: Record<string, unknown>, key: string) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function addIssue(items: RecipeImportIssue[], field: string | null, message: string) {
  items.push({ field, message });
}

function addUnknownKeyIssues(value: Record<string, unknown>, allowed: Set<string>, prefix: string, items: RecipeImportIssue[]) {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) addIssue(items, `${prefix}.${key}`, "字段不在 ingredient.import.v1 规范中");
  }
}

function requiredKeys(value: Record<string, unknown>, keys: string[], prefix: string, items: RecipeImportIssue[]) {
  for (const key of keys) {
    if (!hasOwn(value, key)) addIssue(items, `${prefix}.${key}`, "字段必须出现");
  }
}

function textValue(value: unknown, field: string, errors: RecipeImportIssue[], maxLength: number, required = true) {
  if (value === null && !required) return null;
  if (typeof value !== "string" || !value.trim()) {
    addIssue(errors, field, required ? "必须填写文本" : "必须是文本或 null");
    return null;
  }
  const text = value.trim();
  if (text.length > maxLength) addIssue(errors, field, `不能超过 ${maxLength} 个字符`);
  return text;
}

function nullableText(value: unknown, field: string, errors: RecipeImportIssue[], maxLength: number) {
  if (value === null) return null;
  return textValue(value, field, errors, maxLength);
}

function imageUrl(value: unknown, field: string, errors: RecipeImportIssue[]) {
  if (value === null) return null;
  const urlText = textValue(value, field, errors, 512);
  if (!urlText) return null;
  try {
    const url = new URL(urlText);
    if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("protocol");
  } catch {
    addIssue(errors, field, "图片地址必须使用 http 或 https");
  }
  return urlText;
}

function parseAliases(value: unknown, field: string, name: string, errors: RecipeImportIssue[]) {
  if (!Array.isArray(value)) {
    addIssue(errors, field, "别名必须是数组");
    return [];
  }
  if (value.length > 20) addIssue(errors, field, "别名不能超过 20 个");
  const aliases: string[] = [];
  const seen = new Set<string>();
  value.forEach((item, index) => {
    const alias = typeof item === "string" ? item.trim() : "";
    if (!alias) {
      addIssue(errors, `${field}.${index}`, "别名不能为空");
      return;
    }
    if (alias.length > 32) addIssue(errors, `${field}.${index}`, "别名不能超过 32 个字符");
    if (alias === name) addIssue(errors, `${field}.${index}`, "别名不能与正式名称相同");
    if (seen.has(alias)) addIssue(errors, `${field}.${index}`, "别名不能重复");
    seen.add(alias);
    aliases.push(alias);
  });
  return aliases;
}

function parseNutrition(value: unknown, field: string, errors: RecipeImportIssue[]): IngredientImportNutritionDraft | null {
  if (value === null) return null;
  if (!isRecord(value)) {
    addIssue(errors, field, "营养数据必须是对象或 null");
    return null;
  }
  addUnknownKeyIssues(value, nutritionKeys, field, errors);
  requiredKeys(value, Array.from(nutritionKeys), field, errors);
  const sourceVersion = textValue(value.sourceVersion, `${field}.sourceVersion`, errors, 64);
  const foodCode = textValue(value.foodCode, `${field}.foodCode`, errors, 32);
  const foodName = textValue(value.foodName, `${field}.foodName`, errors, 128);
  const matchType = typeof value.matchType === "string" && matchTypes.has(value.matchType) ? value.matchType : null;
  if (!matchType) addIssue(errors, `${field}.matchType`, "营养匹配类型不支持");
  const confidence = typeof value.confidence === "number" ? value.confidence : NaN;
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) addIssue(errors, `${field}.confidence`, "可信度必须是 0 到 1 之间的数字");
  const conversions: Array<{ unitName: string; gramsPerUnit: number }> = [];
  if (!Array.isArray(value.conversions)) {
    addIssue(errors, `${field}.conversions`, "单位换算必须是数组");
  } else {
    value.conversions.forEach((item, index) => {
      const itemField = `${field}.conversions.${index}`;
      if (!isRecord(item)) {
        addIssue(errors, itemField, "单位换算必须是对象");
        return;
      }
      addUnknownKeyIssues(item, conversionKeys, itemField, errors);
      requiredKeys(item, Array.from(conversionKeys), itemField, errors);
      const unitName = textValue(item.unitName, `${itemField}.unitName`, errors, 16);
      const gramsPerUnit = typeof item.gramsPerUnit === "number" ? item.gramsPerUnit : NaN;
      if (!Number.isFinite(gramsPerUnit) || gramsPerUnit <= 0) addIssue(errors, `${itemField}.gramsPerUnit`, "克重必须是大于 0 的数字");
      if (unitName && Number.isFinite(gramsPerUnit) && gramsPerUnit > 0) conversions.push({ unitName, gramsPerUnit });
    });
  }
  if (!sourceVersion || !foodCode || !foodName || !matchType || !Number.isFinite(confidence)) return null;
  return {
    sourceVersion,
    foodCode,
    foodName,
    matchType: matchType as IngredientImportNutritionDraft["matchType"],
    confidence,
    conversions
  };
}

function parseItem(value: unknown, sourcePath: string, index: number): IngredientImportItemDraft {
  const errors: RecipeImportIssue[] = [];
  const field = `ingredients.${index}`;
  const item = isRecord(value) ? value : {};
  if (!isRecord(value)) addIssue(errors, field, "食材必须是对象");
  addUnknownKeyIssues(item, ingredientKeys, field, errors);
  requiredKeys(item, Array.from(ingredientKeys), field, errors);
  const name = textValue(item.name, `${field}.name`, errors, 64) ?? "";
  const aliases = parseAliases(item.aliases, `${field}.aliases`, name, errors);
  const categoryCode = typeof item.categoryCode === "string" && categoryCodes.has(item.categoryCode) ? item.categoryCode : null;
  if (!categoryCode) addIssue(errors, `${field}.categoryCode`, "食材分类代码不支持");
  const defaultUnitName = nullableText(item.defaultUnitName, `${field}.defaultUnitName`, errors, 16);
  const proteinType = item.proteinType === null ? null : typeof item.proteinType === "string" && proteinTypes.has(item.proteinType) ? item.proteinType : null;
  if (item.proteinType !== null && !proteinType) addIssue(errors, `${field}.proteinType`, "主蛋白类型不支持");
  if (typeof item.isStaple !== "boolean") addIssue(errors, `${field}.isStaple`, "是否主食必须是布尔值");
  if (typeof item.isSpicyIngredient !== "boolean") addIssue(errors, `${field}.isSpicyIngredient`, "是否辣味食材必须是布尔值");
  const image = imageUrl(item.imageUrl, `${field}.imageUrl`, errors);
  const nutrition = parseNutrition(item.nutrition, `${field}.nutrition`, errors);
  return {
    sourcePath,
    sourceIndex: index,
    name,
    aliases,
    categoryCode,
    defaultUnitName,
    proteinType: proteinType as IngredientImportItemDraft["proteinType"],
    isStaple: item.isStaple === true,
    isSpicyIngredient: item.isSpicyIngredient === true,
    imageUrl: image,
    nutrition,
    errorItems: errors,
    warnItems: []
  };
}

export function parseIngredientImportSource(source: IngredientImportJsonSource): IngredientImportJsonResult {
  const errors: RecipeImportIssue[] = [];
  let document: unknown;
  try {
    document = JSON.parse(source.jsonText);
  } catch {
    addIssue(errors, null, "JSON 格式错误");
    return { items: [], errorItems: errors, warnItems: [] };
  }
  const root = isRecord(document) ? document : {};
  addUnknownKeyIssues(root, rootKeys, "", errors);
  if (root.schemaVersion !== "ingredient.import.v1") addIssue(errors, "schemaVersion", "必须使用 ingredient.import.v1");
  if (!Array.isArray(root.ingredients) || root.ingredients.length === 0) {
    addIssue(errors, "ingredients", "必须填写至少一条食材");
    return { items: [], errorItems: errors, warnItems: [] };
  }
  if (root.ingredients.length > 500) addIssue(errors, "ingredients", "单个 JSON 不能超过 500 条食材");
  const items = root.ingredients.map((item, index) => parseItem(item, source.sourcePath, index));
  const seenNames = new Map<string, number>();
  const duplicateIssues = new Set<string>();
  items.forEach(item => {
    const names = [item.name, ...item.aliases].filter(Boolean);
    names.forEach(name => {
      const previousIndex = seenNames.get(name);
      if (previousIndex !== undefined) {
        const issueKey = `${item.sourceIndex}:${previousIndex}`;
        if (!duplicateIssues.has(issueKey)) {
          item.errorItems.push({ field: `ingredients.${item.sourceIndex}.name`, message: `与第 ${previousIndex + 1} 条食材的名称或别名重复` });
          duplicateIssues.add(issueKey);
        }
      }
      else seenNames.set(name, item.sourceIndex);
    });
  });
  const itemErrors = items.flatMap(item => item.errorItems);
  return { items, errorItems: [...errors, ...itemErrors], warnItems: [] };
}
