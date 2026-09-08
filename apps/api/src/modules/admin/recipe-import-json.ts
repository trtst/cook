import { posix } from "node:path";
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
import { buildSearchKey } from "../recipe/recipe-content";

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

const maxJsonZipEntries = 100;
const maxJsonEntryBytes = 10 * 1024 * 1024;
const maxJsonUncompressedBytes = 20 * 1024 * 1024;

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
  "ingredients",
  "tools",
  "steps"
]);
const wikiKeys = new Set(["tags", "assistant"]);
const ingredientKeys = new Set(["name", "quantity", "unit"]);
const toolKeys = new Set(["name"]);
const stepKeys = new Set(["text", "imageUrl"]);
const tagKeys = new Set(["tagCode", "tagValue"]);
const assistantKeys = new Set(["steps"]);
const assistantStepKeys = new Set(["order", "phase", "action", "title", "detail", "imageUrl", "durationMinutes", "durationText"]);
const tagValues: Record<RecipeImportTagCode, Set<string>> = {
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
  const seenCodes = new Set<string>();
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
    if (seenCodes.has(code)) {
      addIssue(errors, `${field}.tagCode`, "同一标签代码不能重复");
      return;
    }
    seenCodes.add(code);
    tags.push({ tagCode: code, tagValue: item.tagValue });
  });
  for (const code of tagCodes) {
    if (!tags.some(item => item.tagCode === code)) addIssue(errors, "wiki.tags", `缺少 ${code} 标签`);
  }
  return tags;
}

function parseAssistantSteps(value: unknown, errors: RecipeImportIssue[]) {
  const steps: RecipeImportAssistantStepDraft[] = [];
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
  if (!Number.isInteger(categoryId) || Number(categoryId) <= 0) addIssue(errors, "recipe.inspirationCategoryId", "必须填写有效灵感分类 ID");
  const coverImageUrl = hasOwn(recipe, "coverImageUrl") ? sourceImageUrl(recipe.coverImageUrl, "recipe.coverImageUrl", errors) : null;

  const title = typeof content.name === "string" ? content.name.trim() : "";
  const story = typeof content.story === "string" ? content.story.trim() : "";
  const tips = typeof content.tips === "string" ? content.tips.trim() : "";
  if (!title) addIssue(errors, "recipe.content.name", "菜谱名称不能为空");
  if (!story) addIssue(errors, "recipe.content.story", "菜谱故事不能为空");
  if (!tips) addIssue(errors, "recipe.content.tips", "做饭建议不能为空");
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
    const quantity = exactQuantity(row.quantity, `${field}.quantity`, errors);
    const sourceUnit = typeof row.unit === "string" ? row.unit.trim() : "";
    if (!name) addIssue(errors, `${field}.name`, "食材名称不能为空");
    if (!sourceUnit) addIssue(errors, `${field}.unit`, "单位不能为空，无法确认时待人工确认");
    const unitAlias = unitAliasMap.get(sourceUnit.toLowerCase());
    const unitName = unitAlias?.name ?? sourceUnit;
    const normalizedQuantity = quantity && unitAlias ? scaleQuantity(quantity, unitAlias.factor) : quantity;
    const ingredient = refs.ingredientByName.get(buildSearchKey(name));
    const unit = refs.unitByName.get(buildSearchKey(unitName));
    if (!ingredient && name) addIssue(errors, `${field}.name`, "未严格匹配到系统食材");
    if (!unit && sourceUnit) addIssue(errors, `${field}.unit`, "未严格匹配到系统单位");
    ingredients.push({
      line: [name, row.quantity, sourceUnit].filter(value => typeof value === "string" && value.trim()).join(" "),
      ingredientName: name,
      ingredientId: ingredient?.id ?? null,
      quantity: normalizedQuantity,
      unitText: unitName || null,
      unitId: unit?.id ?? null,
      fuzzyText: null,
      note: null
    });
  });

  const steps: RecipeImportBodyStep[] = [];
  if (!Array.isArray(content.steps) || content.steps.length === 0) addIssue(errors, "recipe.content.steps", "至少需要一条制作步骤");
  else content.steps.forEach((item, index) => {
    const field = `recipe.content.steps.${index}`;
    const row = isRecord(item) ? item : {};
    addUnknownKeyIssues(row, stepKeys, field, errors);
    const text = typeof row.text === "string" ? row.text.trim() : "";
    if (!text) addIssue(errors, `${field}.text`, "制作步骤正文不能为空");
    if (!hasOwn(row, "imageUrl")) addIssue(errors, `${field}.imageUrl`, "imageUrl 字段必须出现");
    const imageUrl = sourceImageUrl(row.imageUrl, `${field}.imageUrl`, errors);
    steps.push({ text, imageUrl, imageKey: null, imageTempKey: null });
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
  if (!recipeBody.inspirationCategoryId) addIssue(errors, "inspirationCategoryId", "请选择系统菜谱分类");
  if (!recipeBody.title.trim()) addIssue(errors, "title", "菜谱名称不能为空");
  if (!recipeBody.story?.trim()) addIssue(errors, "story", "菜谱故事不能为空");
  if (!recipeBody.tips?.trim()) addIssue(errors, "tips", "做饭建议不能为空");
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
    if (!item.unitId) addIssue(errors, `ingredients.${index}.unitId`, "单位还未匹配系统单位");
    if (!item.unitText?.trim()) addIssue(errors, `ingredients.${index}.unitText`, "单位还未确认");
    if (!item.quantity || !/^\d+(?:\.\d+)?$/.test(item.quantity) || Number(item.quantity) <= 0) {
      addIssue(errors, `ingredients.${index}.quantity`, "数量必须是大于 0 的单值");
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
    tools: body.tools ?? [],
    tags: body.tags ?? [],
    assistantSteps: body.assistantSteps ?? [],
    steps: (body.steps ?? []).map(step => ({
      ...step,
      imageUrl: step.imageUrl ?? null
    }))
  };
}

type RecipeImportBodyStep = RecipeImportRecipeBody["steps"][number];

export function cleanZipPath(value: string) {
  const normalizedInput = value.replace(/\\/g, "/");
  if (normalizedInput.startsWith("/") || /^[A-Za-z]:\//.test(normalizedInput)) return "";
  const rawParts = normalizedInput.split("/");
  if (rawParts.some(part => part === "..")) return "";
  const normalized = posix.normalize(normalizedInput).replace(/^\/+/, "");
  const parts = normalized.split("/").filter(Boolean);
  if (parts.some(part => part === "..")) return "";
  return parts.join("/");
}

export function readJsonSources(fileName: string, buffer: Buffer): RecipeImportJsonSource[] {
  const lowerName = fileName.toLowerCase();
  if (lowerName.endsWith(".json")) {
    if (buffer.byteLength > maxJsonEntryBytes) throw new Error("JSON 文件大小不能超过 10 MB");
    return [{ sourcePath: fileName, jsonText: buffer.toString("utf8") }];
  }
  if (!lowerName.endsWith(".zip")) throw new Error("目前只支持导入 .json 或包含 JSON 的 .zip 文件");

  const AdmZip = require("adm-zip");
  const zip = new AdmZip(buffer);
  const entries = zip.getEntries() as Array<{ entryName: string; isDirectory: boolean; getData: () => Buffer }>;
  const sources: RecipeImportJsonSource[] = [];
  let jsonEntryCount = 0;
  let uncompressedBytes = 0;
  for (const entry of entries) {
    const safePath = cleanZipPath(entry.entryName);
    if (!safePath) throw new Error("ZIP 包含不安全路径");
    if (entry.isDirectory || safePath.startsWith("__MACOSX/") || !safePath.toLowerCase().endsWith(".json")) continue;
    jsonEntryCount += 1;
    if (jsonEntryCount > maxJsonZipEntries) throw new Error("JSON 文件数量不能超过 100 个");
    const data = entry.getData();
    if (data.byteLength > maxJsonEntryBytes) throw new Error("JSON 文件大小不能超过 10 MB");
    uncompressedBytes += data.byteLength;
    if (uncompressedBytes > maxJsonUncompressedBytes) throw new Error("ZIP 解压后的 JSON 总大小不能超过 20 MB");
    sources.push({ sourcePath: safePath, jsonText: data.toString("utf8") });
  }
  return sources;
}
