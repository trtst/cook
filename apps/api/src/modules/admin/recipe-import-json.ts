import type {
  RecipeDifficulty,
  RecipeDuration,
  RecipeImportAssistantAction,
  RecipeImportAssistantPhase,
  RecipeImportAssistantStepDraft,
  RecipeImportIssue,
  RecipeImportParsedBody,
  RecipeImportRawBody,
  RecipeImportRecipeBody,
  RecipeImportTagCode,
  RecipeImportTagDraft,
  RecipeImportToolDraft
} from "../../contracts/types";
import { canUseFuzzyAmount, fuzzyAmountCategoryMessage } from "../../common/recipe-amount-policy";
import { buildSearchKey } from "../recipe/recipe-content";

const AdmZip = require("adm-zip");

export interface RecipeImportJsonSource {
  sourcePath: string;
  jsonText: string;
}

export interface RecipeImportJsonRefs {
  ingredientByName: Map<string, { id: number; name: string; categoryId: number }>;
  unitByName: Map<string, { id: number; name: string; type?: string }>;
}

export interface RecipeImportJsonResult {
  rawBody: RecipeImportRawBody;
  parsedBody: RecipeImportParsedBody;
  recipeBody: RecipeImportRecipeBody;
  errorItems: RecipeImportIssue[];
  warnItems: RecipeImportIssue[];
}

const maxJsonFiles = 100;
const maxJsonFileBytes = 10 * 1024 * 1024;
const maxJsonBatchBytes = 20 * 1024 * 1024;
const maxZipFileBytes = 20 * 1024 * 1024;
const maxZipDepth = 8;

const recipeKeys = new Set([
  "inspirationCategoryId",
  "coverImageUrl",
  "content"
]);
const rootKeys = new Set(["schemaVersion", "recipe", "wiki"]);
const contentKeys = new Set([
  "name",
  "story",
  "baseServings",
  "difficulty",
  "duration",
  "tips",
  "keywords",
  "ingredients",
  "tools",
  "steps"
]);
const wikiKeys = new Set(["tags", "assistant"]);
const ingredientKeys = new Set(["name", "quantity", "unit", "fuzzyText", "categoryCode"]);
const toolKeys = new Set(["name"]);
const stepKeys = new Set(["text", "imageUrl", "imagePrompt"]);
const tagKeys = new Set(["tagCode", "tagValue"]);
const assistantKeys = new Set(["steps"]);
const assistantStepKeys = new Set(["order", "phase", "action", "title", "detail", "imageUrl", "imageTempKey", "imagePrompt", "durationMinutes", "durationText"]);
const ingredientCategoryCodes = new Set([
  "PRODUCE",
  "MEAT_POULTRY_EGG",
  "SEAFOOD",
  "SOY_DAIRY",
  "GRAINS_STAPLES",
  "SEASONING",
  "DRIED_PRESERVED",
  "BEVERAGE_ALCOHOL"
]);
const tagValues: Record<RecipeImportTagCode, Set<string>> = {
  CUISINE: new Set(["SICHUAN_HUNAN", "JIANG_ZHE", "CANTONESE", "FUJIAN", "NORTHERN", "YUN_GUI", "TAIWAN", "FUSION", "OTHER"]),
  DISH_STYLE: new Set(["STIR_FRY", "COLD_DISH", "SOUP", "STAPLE_FOOD", "STEW", "STEAMED", "BRAISED", "FRIED", "BBQ", "HOT_POT", "SNACK"]),
  MEAL_TYPE: new Set(["BREAKFAST", "LUNCH", "AFTERNOON_TEA", "DINNER", "LATE_NIGHT"]),
  DISH_ROLE: new Set(["MAIN", "VEGETABLE", "COLD_DISH", "SOUP", "STAPLE"]),
  MAIN_PROTEIN_TYPE: new Set(["PORK", "CHICKEN", "BEEF", "LAMB", "DUCK", "FISH", "NONE"]),
  FLAVOR_PROFILE: new Set(["LIGHT", "MILD", "SPICY", "SOUR", "SWEET"]),
  SPICE_LEVEL: new Set(["NONE", "MILD", "MEDIUM", "HOT"])
};
const tagCodes = new Set(Object.keys(tagValues));
const actionByPhase: Record<RecipeImportAssistantPhase, Set<RecipeImportAssistantAction>> = {
  PREP: new Set(["SHOP", "WASH", "SOAK", "THAW", "CUT", "SLICE", "DICE", "SHRED", "MINCE", "MARINATE", "BLANCH", "MEASURE", "MIX", "OTHER"]),
  COOK: new Set(["BOIL", "SIMMER", "STEAM", "STIR_FRY", "PAN_FRY", "DEEP_FRY", "BRAISE", "ROAST", "BAKE", "PRESSURE_COOK", "REDUCE", "OTHER"]),
  SERVE: new Set(["SEASON", "PLATE", "GARNISH", "PORTION", "REST", "OTHER"])
};
const phaseSet = new Set<RecipeImportAssistantPhase>(["PREP", "COOK", "SERVE"]);
const difficultySet = new Set<RecipeDifficulty>(["BEGINNER", "EASY", "SKILLED", "CHALLENGING"]);
const durationSet = new Set<RecipeDuration>(["WITHIN_15", "BETWEEN_15_30", "BETWEEN_30_60", "OVER_60"]);
const unitAliasMap = new Map([
  ["g", { name: "克", factor: 1 }],
  ["克", { name: "克", factor: 1 }],
  ["kg", { name: "克", factor: 1000 }],
  ["千克", { name: "克", factor: 1000 }],
  ["ml", { name: "毫升", factor: 1 }],
  ["毫升", { name: "毫升", factor: 1 }],
  ["l", { name: "毫升", factor: 1000 }],
  ["升", { name: "毫升", factor: 1000 }]
]);

export function isImportedIngredientPlaceholder(name: string) {
  return /^导入食材-\d+$/.test(name.trim());
}

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
    if (!allowed.has(key)) addIssue(items, `${prefix}.${key}`, "字段不在 recipe.import.v1 规范中");
  }
}

function sourceImageUrl(value: unknown, field: string, errors: RecipeImportIssue[]) {
  if (value === null) return null;
  if (typeof value !== "string" || !value.trim()) {
    addIssue(errors, field, "图片地址必须是 URL 或 null");
    return null;
  }
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("protocol");
  } catch {
    addIssue(errors, field, "图片地址必须使用 http 或 https");
  }
  return value.trim();
}

function imagePrompt(value: unknown, field: string, errors: RecipeImportIssue[]) {
  const prompt = typeof value === "string" ? value.trim() : "";
  if (!prompt) {
    addIssue(errors, field, "图片提示词不能为空");
    return null;
  }
  if (prompt.length > 1000) {
    addIssue(errors, field, "图片提示词不能超过 1000 个字符");
  }
  if (!/\p{Script=Han}/u.test(prompt)) {
    addIssue(errors, field, "图片提示词必须使用中文");
  }
  return prompt;
}

function exactQuantity(value: unknown, field: string, errors: RecipeImportIssue[]) {
  if (typeof value !== "string" || !value.trim()) {
    addIssue(errors, field, "数量必须填写");
    return null;
  }
  const text = value.trim();
  if (!/^\d+(?:\.\d+)?$/.test(text) || Number(text) <= 0) {
    addIssue(errors, field, "数量必须是大于 0 的单值，模糊用量待人工确认");
    return null;
  }
  return text;
}

function scaleQuantity(value: string, factor: number) {
  if (factor === 1) return value;
  const [whole, fraction = ""] = value.split(".");
  const digits = `${whole}${fraction}`.replace(/^0+(?=\d)/, "") || "0";
  const scaled = (BigInt(digits) * BigInt(factor)).toString();
  if (!fraction) return scaled;
  const splitAt = scaled.length - fraction.length;
  const integerPart = splitAt > 0 ? scaled.slice(0, splitAt) : "0";
  const decimalPart = `${splitAt > 0 ? scaled.slice(splitAt) : scaled.padStart(fraction.length, "0")}`.replace(/0+$/, "");
  return decimalPart ? `${integerPart}.${decimalPart}` : integerPart;
}

function parseTags(value: unknown, errors: RecipeImportIssue[]) {
  const tags: RecipeImportTagDraft[] = [];
  const seenValues = new Set<string>();
  const seenSingleCodes = new Set<string>();
  if (!Array.isArray(value) || value.length === 0) {
    addIssue(errors, "wiki.tags", "必须填写业务标签");
    return tags;
  }
  value.forEach((item, index) => {
    const field = `wiki.tags.${index}`;
    if (!isRecord(item) || typeof item.tagCode !== "string" || typeof item.tagValue !== "string") {
      addIssue(errors, field, "标签必须包含 tagCode 和 tagValue");
      return;
    }
    addUnknownKeyIssues(item, tagKeys, field, errors);
    const code = item.tagCode as RecipeImportTagCode;
    const allowedValues = tagValues[code];
    if (!allowedValues || !tagCodes.has(code)) {
      addIssue(errors, `${field}.tagCode`, "标签代码不支持");
      return;
    }
    if (!allowedValues.has(item.tagValue)) {
      addIssue(errors, `${field}.tagValue`, "标签枚举值不支持");
      return;
    }
    const tagKey = `${code}:${item.tagValue}`;
    if (seenValues.has(tagKey)) {
      addIssue(errors, `${field}.tagValue`, "同一标签值不能重复");
      return;
    }
    if (code !== "MEAL_TYPE" && seenSingleCodes.has(code)) {
      addIssue(errors, `${field}.tagCode`, "除餐次外，同一标签代码不能重复");
      return;
    }
    seenValues.add(tagKey);
    seenSingleCodes.add(code);
    tags.push({ tagCode: code, tagValue: item.tagValue });
  });
  for (const code of tagCodes) {
    if (!tags.some(item => item.tagCode === code)) addIssue(errors, "wiki.tags", `缺少 ${code} 标签`);
  }
  return tags;
}

function parseKeywords(value: unknown, field: string, errors: RecipeImportIssue[]) {
  if (!Array.isArray(value)) {
    addIssue(errors, field, "关键词必须是数组");
    return [];
  }
  if (value.length > 8) addIssue(errors, field, "关键词不能超过 8 个");
  const keywords: string[] = [];
  const seen = new Set<string>();
  value.forEach((item, index) => {
    const keyword = typeof item === "string" ? item.trim() : "";
    if (!keyword) {
      addIssue(errors, `${field}.${index}`, "关键词不能为空");
      return;
    }
    if (seen.has(keyword)) {
      addIssue(errors, `${field}.${index}`, "关键词不能重复");
      return;
    }
    seen.add(keyword);
    keywords.push(keyword);
  });
  return keywords;
}

function parseAssistantSteps(value: unknown, errors: RecipeImportIssue[]) {
  const steps: RecipeImportAssistantStepDraft[] = [];
  const prompts = new Set<string>();
  if (!isRecord(value) || !Array.isArray(value.steps) || value.steps.length === 0) {
    addIssue(errors, "wiki.assistant.steps", "必须填写美食助理步骤");
    return steps;
  }
  addUnknownKeyIssues(value, assistantKeys, "wiki.assistant", errors);
  value.steps.forEach((item, index) => {
    const field = `wiki.assistant.steps.${index}`;
    if (!isRecord(item)) {
      addIssue(errors, field, "助理步骤必须是对象");
      return;
    }
    addUnknownKeyIssues(item, assistantStepKeys, `wiki.assistant.steps.${index}`, errors);
    const order = item.order;
    const phase = item.phase as RecipeImportAssistantPhase;
    const action = item.action as RecipeImportAssistantAction;
    if (!Number.isInteger(order) || order !== index + 1) addIssue(errors, `${field}.order`, "步骤 order 必须从 1 连续递增");
    if (!phaseSet.has(phase)) addIssue(errors, `${field}.phase`, "助理阶段不支持");
    if (phaseSet.has(phase) && !actionByPhase[phase].has(action)) addIssue(errors, `${field}.action`, "动作与助理阶段不匹配");
    for (const key of ["title", "detail"] as const) {
      if (typeof item[key] !== "string" || !item[key].trim()) addIssue(errors, `${field}.${key}`, "助理步骤文本不能为空");
    }
    if (item.durationText !== null && typeof item.durationText !== "string") addIssue(errors, `${field}.durationText`, "时间必须是文本或 null");
    if (!hasOwn(item, "imageUrl")) addIssue(errors, `${field}.imageUrl`, "imageUrl 字段必须出现");
    const prompt = imagePrompt(item.imagePrompt, `${field}.imagePrompt`, errors);
    if (prompt && prompts.has(prompt)) addIssue(errors, `${field}.imagePrompt`, "同类步骤图片提示词不能重复");
    if (prompt) prompts.add(prompt);
    if (!hasOwn(item, "durationMinutes")) addIssue(errors, `${field}.durationMinutes`, "durationMinutes 字段必须出现");
    else if (!Number.isInteger(item.durationMinutes) || Number(item.durationMinutes) < 1) addIssue(errors, `${field}.durationMinutes`, "durationMinutes 必须是大于 0 的整数");
    if (!hasOwn(item, "durationText")) addIssue(errors, `${field}.durationText`, "durationText 字段必须出现");
    const imageUrl = sourceImageUrl(item.imageUrl, `${field}.imageUrl`, errors);
    steps.push({
      order: Number.isInteger(order) ? Number(order) : index + 1,
      phase: phaseSet.has(phase) ? phase : "PREP",
      action: phaseSet.has(phase) && actionByPhase[phase].has(action) ? action : "OTHER",
      title: typeof item.title === "string" ? item.title.trim() : "",
      detail: typeof item.detail === "string" ? item.detail.trim() : "",
      imageUrl,
      imagePrompt: prompt,
      durationMinutes: Number.isInteger(item.durationMinutes) && Number(item.durationMinutes) >= 1 ? Number(item.durationMinutes) : null,
      durationText: typeof item.durationText === "string" ? item.durationText.trim() : null
    });
  });
  return steps;
}

export function parseJsonSource(source: RecipeImportJsonSource, refs: RecipeImportJsonRefs): RecipeImportJsonResult {
  const errors: RecipeImportIssue[] = [];
  const warnings: RecipeImportIssue[] = [];
  let document: unknown;
  try {
    document = JSON.parse(source.jsonText);
  } catch {
    document = null;
    addIssue(errors, null, "JSON 格式错误");
  }

  const root = isRecord(document) ? document : {};
  addUnknownKeyIssues(root, rootKeys, "", errors);
  if (root.schemaVersion !== "recipe.import.v1") addIssue(errors, "schemaVersion", "必须使用 recipe.import.v1");
  if (!isRecord(root.recipe)) addIssue(errors, "recipe", "必须填写 recipe 对象");
  if (!isRecord(root.wiki)) addIssue(errors, "wiki", "必须填写 wiki 对象");

  const recipe = isRecord(root.recipe) ? root.recipe : {};
  const wiki = isRecord(root.wiki) ? root.wiki : {};
  addUnknownKeyIssues(recipe, recipeKeys, "recipe", errors);
  addUnknownKeyIssues(wiki, wikiKeys, "wiki", errors);
  if (hasOwn(root, "id") || hasOwn(recipe, "id") || hasOwn(recipe, "expectedVersion")) {
    addIssue(errors, "recipe", "导入 JSON 不允许包含菜谱 ID 或版本号");
  }
  if (hasOwn(wiki, "nutrition")) addIssue(errors, "wiki.nutrition", "营养分析由后台派生，不允许从 JSON 导入");

  const content = isRecord(recipe.content) ? recipe.content : {};
  if (!isRecord(recipe.content)) addIssue(errors, "recipe.content", "必须填写 recipe.content 对象");
  addUnknownKeyIssues(content, contentKeys, "recipe.content", errors);
  const categoryId = recipe.inspirationCategoryId;
  if (categoryId === null) addIssue(errors, "recipe.inspirationCategoryId", "系统菜谱分类待人工选择");
  else if (!Number.isInteger(categoryId) || Number(categoryId) <= 0) addIssue(errors, "recipe.inspirationCategoryId", "必须填写有效灵感分类 ID");
  const coverImageUrl = hasOwn(recipe, "coverImageUrl") ? sourceImageUrl(recipe.coverImageUrl, "recipe.coverImageUrl", errors) : null;

  const title = typeof content.name === "string" ? content.name.trim() : "";
  const story = typeof content.story === "string" ? content.story.trim() : "";
  const tips = typeof content.tips === "string" ? content.tips.trim() : "";
  if (!title) addIssue(errors, "recipe.content.name", "菜谱名称不能为空");
  if (!story) addIssue(errors, "recipe.content.story", "菜谱故事不能为空");
  if (!tips) addIssue(errors, "recipe.content.tips", "做饭建议不能为空");
  const keywords = parseKeywords(content.keywords, "recipe.content.keywords", errors);
  if (!Number.isInteger(content.baseServings) || Number(content.baseServings) < 1 || Number(content.baseServings) > 20) addIssue(errors, "recipe.content.baseServings", "基准人数必须为 1 到 20 的整数");
  if (!difficultySet.has(content.difficulty as RecipeDifficulty)) addIssue(errors, "recipe.content.difficulty", "难度枚举值不支持");
  if (!durationSet.has(content.duration as RecipeDuration)) addIssue(errors, "recipe.content.duration", "总时长枚举值不支持");

  const tools: RecipeImportToolDraft[] = [];
  if (!Array.isArray(content.tools)) addIssue(errors, "recipe.content.tools", "tools 必须是数组");
  else content.tools.forEach((item, index) => {
    if (!isRecord(item)) {
      addIssue(errors, `recipe.content.tools.${index}`, "厨具必须是对象");
      return;
    }
    addUnknownKeyIssues(item, toolKeys, `recipe.content.tools.${index}`, errors);
    if (typeof item.name !== "string" || !item.name.trim()) addIssue(errors, `recipe.content.tools.${index}.name`, "厨具名称不能为空");
    else tools.push({ name: item.name.trim() });
  });

  const ingredients: RecipeImportRecipeBody["ingredients"] = [];
  if (!Array.isArray(content.ingredients) || content.ingredients.length === 0) addIssue(errors, "recipe.content.ingredients", "至少需要一条食材");
  else content.ingredients.forEach((item, index) => {
    const field = `recipe.content.ingredients.${index}`;
    const row = isRecord(item) ? item : {};
    addUnknownKeyIssues(row, ingredientKeys, field, errors);
    const name = typeof row.name === "string" ? row.name.trim() : "";
    const hasFuzzyText = hasOwn(row, "fuzzyText");
    if (!hasFuzzyText) addIssue(errors, `${field}.fuzzyText`, "fuzzyText 字段必须出现");
    const isFuzzy = row.fuzzyText === "适量";
    if (hasFuzzyText && row.fuzzyText !== null && !isFuzzy) {
      addIssue(errors, `${field}.fuzzyText`, "模糊用量只支持“适量”或 null");
    }
    if (isFuzzy && (row.quantity !== null || row.unit !== null)) {
      addIssue(errors, `${field}.fuzzyText`, "精确用量与模糊用量不能同时填写");
    }
    const quantity = isFuzzy ? null : exactQuantity(row.quantity, `${field}.quantity`, errors);
    const sourceUnit = isFuzzy ? "" : typeof row.unit === "string" ? row.unit.trim() : "";
    const categoryCode = typeof row.categoryCode === "string" ? row.categoryCode.trim() : "";
    if (!name) addIssue(errors, `${field}.name`, "食材名称不能为空");
    if (!isFuzzy && !sourceUnit) addIssue(errors, `${field}.unit`, "单位不能为空，无法确认时待人工确认");
    if (!ingredientCategoryCodes.has(categoryCode)) addIssue(errors, `${field}.categoryCode`, "食材分类代码不支持");
    if (isFuzzy && !canUseFuzzyAmount(categoryCode)) {
      addIssue(errors, `${field}.fuzzyText`, fuzzyAmountCategoryMessage);
    }
    const unitAlias = unitAliasMap.get(sourceUnit.toLowerCase());
    const unitName = unitAlias?.name ?? sourceUnit;
    const normalizedQuantity = quantity && unitAlias ? scaleQuantity(quantity, unitAlias.factor) : quantity;
    const ingredient = refs.ingredientByName.get(buildSearchKey(name));
    const unit = isFuzzy ? undefined : refs.unitByName.get(buildSearchKey(unitName));
    if (!ingredient && name) addIssue(errors, `${field}.name`, "未严格匹配到系统食材");
    if (!isFuzzy && !unit && sourceUnit) addIssue(errors, `${field}.unit`, "未严格匹配到系统单位");
    ingredients.push({
      line: [name, isFuzzy ? "适量" : row.quantity, sourceUnit].filter(value => typeof value === "string" && value.trim()).join(" "),
      ingredientName: name,
      ingredientId: ingredient?.id ?? null,
      quantity: normalizedQuantity,
      unitText: isFuzzy ? null : unitName || null,
      unitId: unit?.id ?? null,
      fuzzyText: isFuzzy ? "适量" : null,
      note: null,
      categoryCode: ingredientCategoryCodes.has(categoryCode) ? categoryCode : null
    });
  });

  const steps: RecipeImportBodyStep[] = [];
  const stepPrompts = new Set<string>();
  if (!Array.isArray(content.steps) || content.steps.length === 0) addIssue(errors, "recipe.content.steps", "至少需要一条制作步骤");
  else content.steps.forEach((item, index) => {
    const field = `recipe.content.steps.${index}`;
    const row = isRecord(item) ? item : {};
    addUnknownKeyIssues(row, stepKeys, field, errors);
    const text = typeof row.text === "string" ? row.text.trim() : "";
    if (!text) addIssue(errors, `${field}.text`, "制作步骤正文不能为空");
    if (!hasOwn(row, "imageUrl")) addIssue(errors, `${field}.imageUrl`, "imageUrl 字段必须出现");
    const imageUrl = sourceImageUrl(row.imageUrl, `${field}.imageUrl`, errors);
    const prompt = imagePrompt(row.imagePrompt, `${field}.imagePrompt`, errors);
    if (prompt && stepPrompts.has(prompt)) addIssue(errors, `${field}.imagePrompt`, "同类步骤图片提示词不能重复");
    if (prompt) stepPrompts.add(prompt);
    steps.push({ text, imageUrl, imageKey: null, imageTempKey: null, imagePrompt: prompt });
  });

  const tags = parseTags(wiki.tags, errors);
  const assistantSteps = parseAssistantSteps(wiki.assistant, errors);
  const recipeBody: RecipeImportRecipeBody = {
    inspirationCategoryId: Number.isInteger(categoryId) && Number(categoryId) > 0 ? Number(categoryId) : null,
    title,
    story: story || null,
    baseServings: Number.isInteger(content.baseServings) ? Number(content.baseServings) : null,
    difficulty: difficultySet.has(content.difficulty as RecipeDifficulty) ? content.difficulty as RecipeDifficulty : null,
    duration: durationSet.has(content.duration as RecipeDuration) ? content.duration as RecipeDuration : null,
    tips: tips || null,
    keywords,
    coverImageUrl,
    coverImageKey: null,
    coverImageTempKey: null,
    tools,
    tags,
    assistantSteps,
    ingredients,
    steps
  };
  const parsedBody: RecipeImportParsedBody = {
    titleLine: title || null,
    story: story || null,
    baseServingsText: content.baseServings == null ? null : String(content.baseServings),
    difficultyText: typeof content.difficulty === "string" ? content.difficulty : null,
    durationText: typeof content.duration === "string" ? content.duration : null,
    caloriesText: null,
    ingredientLines: ingredients.map(item => item.line),
    stepLines: steps.map(item => item.text),
    tipLines: tips ? [tips] : []
  };
  return {
    rawBody: { sourcePath: source.sourcePath, jsonText: source.jsonText, assetFolder: "", images: [] },
    parsedBody,
    recipeBody,
    errorItems: errors,
    warnItems: warnings
  };
}

export function rebuildJsonItemState(recipeBody: RecipeImportRecipeBody) {
  const errors: RecipeImportIssue[] = [];
  const warnings: RecipeImportIssue[] = [];
  if (!recipeBody.inspirationCategoryId) addIssue(errors, "inspirationCategoryId", "系统菜谱分类待人工选择");
  if (!recipeBody.title.trim()) addIssue(errors, "title", "菜谱名称不能为空");
  if (!recipeBody.story?.trim()) addIssue(errors, "story", "菜谱故事不能为空");
  if (!recipeBody.tips?.trim()) addIssue(errors, "tips", "做饭建议不能为空");
  parseKeywords(recipeBody.keywords, "keywords", errors);
  if (!Number.isInteger(recipeBody.baseServings) || Number(recipeBody.baseServings) < 1 || Number(recipeBody.baseServings) > 20) {
    addIssue(errors, "baseServings", "基准人数必须为 1 到 20 的整数");
  }
  if (!recipeBody.difficulty || !difficultySet.has(recipeBody.difficulty)) addIssue(errors, "difficulty", "难度枚举值不支持");
  if (!recipeBody.duration || !durationSet.has(recipeBody.duration)) addIssue(errors, "duration", "总时长枚举值不支持");
  if (!Array.isArray(recipeBody.tools)) {
    addIssue(errors, "tools", "tools 必须是数组");
  } else {
    recipeBody.tools.forEach((item, index) => {
      if (!item || typeof item.name !== "string" || !item.name.trim()) {
        addIssue(errors, `tools.${index}.name`, "厨具名称不能为空");
      }
    });
  }
  if (!recipeBody.ingredients.length) addIssue(errors, "ingredients", "至少需要一条食材");
  recipeBody.ingredients.forEach((item, index) => {
    if (!item.ingredientId) addIssue(errors, `ingredients.${index}.ingredientId`, "食材还未匹配系统食材");
    if (!item.ingredientName?.trim()) addIssue(errors, `ingredients.${index}.ingredientName`, "食材名称不能为空");
    if (item.fuzzyText) {
      if (item.fuzzyText !== "适量") addIssue(errors, `ingredients.${index}.fuzzyText`, "模糊用量只支持“适量”");
      if (!canUseFuzzyAmount(item.categoryCode)) {
        addIssue(errors, `ingredients.${index}.fuzzyText`, fuzzyAmountCategoryMessage);
      }
      if (item.quantity !== null || item.unitId !== null || item.unitText !== null) {
        addIssue(errors, `ingredients.${index}.fuzzyText`, "精确用量与模糊用量不能同时填写");
      }
    } else {
      if (!item.unitId) addIssue(errors, `ingredients.${index}.unitId`, "单位还未匹配系统单位");
      if (!item.unitText?.trim()) addIssue(errors, `ingredients.${index}.unitText`, "单位还未确认");
      if (!item.quantity || !/^\d+(?:\.\d+)?$/.test(item.quantity) || Number(item.quantity) <= 0) {
        addIssue(errors, `ingredients.${index}.quantity`, "数量必须是大于 0 的单值");
      }
    }
  });
  if (!recipeBody.steps.length) addIssue(errors, "steps", "至少需要一条制作步骤");
  recipeBody.steps.forEach((item, index) => {
    if (!item.text.trim()) addIssue(errors, `steps.${index}.text`, "制作步骤正文不能为空");
    if (item.imageUrl !== null && item.imageUrl !== undefined) sourceImageUrl(item.imageUrl, `steps.${index}.imageUrl`, errors);
  });
  parseTags(recipeBody.tags ?? [], errors);
  parseAssistantSteps({ steps: recipeBody.assistantSteps ?? [] }, errors);
  return { errorItems: errors, warnItems: warnings };
}

export function normalizeRecipeImportBody(body: RecipeImportRecipeBody): RecipeImportRecipeBody {
  return {
    ...body,
    coverImageUrl: body.coverImageUrl ?? null,
    keywords: body.keywords ?? [],
    tools: body.tools ?? [],
    tags: body.tags ?? [],
    assistantSteps: body.assistantSteps ?? [],
    ingredients: (body.ingredients ?? []).map(item => {
      const isFuzzy = Boolean(item.fuzzyText);
      return {
        ...item,
        quantity: isFuzzy ? null : item.quantity ?? null,
        unitText: isFuzzy ? null : item.unitText ?? null,
        unitId: isFuzzy ? null : item.unitId ?? null,
        fuzzyText: isFuzzy ? "适量" : null
      };
    }),
    steps: (body.steps ?? []).map(step => ({
      ...step,
      imageUrl: step.imageUrl ?? null,
      imagePrompt: step.imagePrompt ?? null
    }))
  };
}

type RecipeImportBodyStep = RecipeImportRecipeBody["steps"][number];

function addJsonDocumentSources(
  sources: RecipeImportJsonSource[],
  sourcePath: string,
  jsonText: string
) {
  let document: unknown;
  try {
    document = JSON.parse(jsonText);
  } catch {
    sources.push({ sourcePath, jsonText });
    return;
  }
  if (isRecord(document) && document.schemaVersion === "recipe.import.batch.v1" && Array.isArray(document.recipes)) {
    document.recipes.forEach((recipe, index) => {
      sources.push({
        sourcePath: `${sourcePath}#${index + 1}`,
        jsonText: JSON.stringify({
          schemaVersion: "recipe.import.v1",
          recipe: isRecord(recipe) ? recipe.recipe : undefined,
          wiki: isRecord(recipe) ? recipe.wiki : undefined
        })
      });
    });
    return;
  }
  sources.push({ sourcePath, jsonText });
}

function assertZipEntryPath(entryName: string) {
  if (!entryName || entryName.startsWith("/") || entryName.includes("\\") || entryName.split("/").some(part => part === ".." || part === "")) {
    throw new Error("ZIP 内包含不安全路径");
  }
  if (entryName.split("/").length > maxZipDepth) throw new Error("ZIP 目录层级不能超过 8 层");
}

function readZipJsonSources(
  file: { originalname?: string; buffer?: Buffer },
  sources: RecipeImportJsonSource[],
  addBytes: (bytes: number) => void
) {
  if (!file.buffer || !file.originalname) throw new Error("请上传有效的 ZIP 文件");
  if (file.buffer.byteLength > maxZipFileBytes) throw new Error("ZIP 文件大小不能超过 20 MB");
  let zip: any;
  try {
    zip = new AdmZip(file.buffer);
  } catch {
    throw new Error("ZIP 文件无法读取");
  }
  const entries = zip.getEntries();
  if (!entries.length || entries.length > maxJsonFiles) throw new Error("ZIP 内 JSON 文件数量必须为 1 到 100 个");
  for (const entry of entries) {
    const entryName = entry.entryName;
    if (entry.isDirectory) {
      assertZipEntryPath(entryName.replace(/\/+$/, ""));
      continue;
    }
    assertZipEntryPath(entryName);
    const unixFileType = ((entry.header.attr >>> 16) & 0o170000);
    if (unixFileType === 0o120000) throw new Error("ZIP 不允许符号链接");
    if (!entryName.toLowerCase().endsWith(".json")) throw new Error("ZIP 只允许包含 JSON 文件");
    const content = entry.getData();
    if (content.byteLength > maxJsonFileBytes) throw new Error("ZIP 内单个 JSON 文件大小不能超过 10 MB");
    addBytes(content.byteLength);
    addJsonDocumentSources(sources, `${file.originalname}/${entryName}`, content.toString("utf8"));
    if (sources.length > maxJsonFiles) throw new Error("展开后的菜谱数量不能超过 100 个");
  }
}

export function readJsonSourcesFromFiles(files: Array<{ originalname?: string; buffer?: Buffer; size?: number }>) {
  if (files.length === 0) throw new Error("请至少上传一个 JSON 文件");
  if (files.length > maxJsonFiles) throw new Error("文件数量不能超过 100 个");

  const sources: RecipeImportJsonSource[] = [];
  let totalBytes = 0;
  const addBytes = (bytes: number) => {
    totalBytes += bytes;
    if (totalBytes > maxJsonBatchBytes) throw new Error("批量 JSON 总大小不能超过 20 MB");
  };
  for (const file of files) {
    if (!file.buffer || !file.originalname) throw new Error("请上传有效的 JSON 文件");
    if (file.originalname.toLowerCase().endsWith(".zip")) {
      readZipJsonSources(file, sources, addBytes);
      continue;
    }
    if (!file.originalname.toLowerCase().endsWith(".json")) throw new Error("目前只支持 JSON 或 ZIP 文件");
    if (file.buffer.byteLength > maxJsonFileBytes) throw new Error("单个 JSON 文件大小不能超过 10 MB");
    addBytes(file.buffer.byteLength);
    addJsonDocumentSources(sources, file.originalname, file.buffer.toString("utf8"));
    if (sources.length > maxJsonFiles) throw new Error("展开后的菜谱数量不能超过 100 个");
  }
  return sources;
}
