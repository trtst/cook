import type {
  RecipeImportAssistantPhase,
  RecipeImportAssistantStepDraft,
  RecipeImportAssistantAction,
  RecipeImportIssue,
  RecipeImportTagDraft,
  UUID
} from "../../contracts/types";

export interface RecipeWikiImportItem {
  recipeId: UUID;
  contentVersionId: UUID;
  tags: RecipeImportTagDraft[];
  assistantSteps: RecipeImportAssistantStepDraft[];
  recipeContent: Record<string, unknown> | null;
}

export type RecipeWikiReplaceField =
  | "name"
  | "story"
  | "difficulty"
  | "duration"
  | "tips"
  | "keywords"
  | "ingredients"
  | "tools"
  | "steps"
  | "tags"
  | "assistant.steps";

export interface RecipeWikiDocumentResult {
  items: RecipeWikiImportItem[];
  invalidItems: Array<{ recipeId: UUID; issues: RecipeImportIssue[] }>;
  issues: RecipeImportIssue[];
}

const tagCodes = new Set([
  "CUISINE",
  "DISH_STYLE",
  "MEAL_TYPE",
  "DISH_ROLE",
  "MAIN_PROTEIN_TYPE",
  "FLAVOR_PROFILE",
  "SPICE_LEVEL"
]);
const phases = new Set<RecipeImportAssistantPhase>(["PREP", "COOK", "SERVE"]);
const actions = new Set<RecipeImportAssistantAction>([
  "SHOP",
  "WASH",
  "SOAK",
  "THAW",
  "CUT",
  "SLICE",
  "DICE",
  "SHRED",
  "MINCE",
  "MARINATE",
  "BLANCH",
  "MEASURE",
  "MIX",
  "BOIL",
  "SIMMER",
  "STEAM",
  "STIR_FRY",
  "PAN_FRY",
  "DEEP_FRY",
  "BRAISE",
  "ROAST",
  "BAKE",
  "PRESSURE_COOK",
  "REDUCE",
  "SEASON",
  "PLATE",
  "GARNISH",
  "PORTION",
  "REST",
  "OTHER"
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function issue(issues: RecipeImportIssue[], field: string | null, message: string) {
  issues.push({ field, message });
}

function assertKnownKeys(value: Record<string, unknown>, allowed: Set<string>, path: string, issues: RecipeImportIssue[]) {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) issue(issues, path ? `${path}.${key}` : key, "字段不属于 recipe.wiki.v1 规范");
  }
}

function parseItem(
  value: unknown,
  path: string,
  issues: RecipeImportIssue[],
  selectedFields: ReadonlySet<RecipeWikiReplaceField>
): RecipeWikiImportItem | null {
  if (!isRecord(value)) {
    issue(issues, path, "菜谱 Wiki 条目必须是对象");
    return null;
  }
  assertKnownKeys(value, new Set(["recipeId", "contentVersionId", "wiki", "recipeContent"]), path, issues);
  const recipeId = value.recipeId;
  const contentVersionId = value.contentVersionId;
  if (!Number.isInteger(recipeId) || Number(recipeId) < 1) issue(issues, `${path}.recipeId`, "recipeId 必须填写有效菜谱 ID");
  if (!Number.isInteger(contentVersionId) || Number(contentVersionId) < 1) {
    issue(issues, `${path}.contentVersionId`, "contentVersionId 必须填写有效正文版本 ID");
  }
  const wiki = isRecord(value.wiki) ? value.wiki : null;
  const needsTags = selectedFields.has("tags");
  const needsAssistant = selectedFields.has("assistant.steps");
  if ((needsTags || needsAssistant) && !wiki) {
    issue(issues, `${path}.wiki`, "必须填写 wiki 对象");
    return null;
  }
  if (wiki) assertKnownKeys(wiki, new Set(["tags", "assistant"]), `${path}.wiki`, issues);

  const tags: RecipeImportTagDraft[] = [];
  if (needsTags && !Array.isArray(wiki?.tags)) {
    issue(issues, `${path}.wiki.tags`, "tags 必须是数组");
  } else if (needsTags && Array.isArray(wiki?.tags)) {
    const seenTags = new Set<string>();
    for (const [index, rawTag] of wiki.tags.entries()) {
      const tagPath = `${path}.wiki.tags.${index}`;
      if (!isRecord(rawTag)) {
        issue(issues, tagPath, "标签必须是对象");
        continue;
      }
      assertKnownKeys(rawTag, new Set(["tagCode", "tagValue"]), tagPath, issues);
      const tagCode = typeof rawTag.tagCode === "string" ? rawTag.tagCode.trim() : "";
      const tagValue = typeof rawTag.tagValue === "string" ? rawTag.tagValue.trim() : "";
      if (!tagCodes.has(tagCode)) issue(issues, `${tagPath}.tagCode`, "Wiki 标签代码不支持");
      if (!tagValue) issue(issues, `${tagPath}.tagValue`, "Wiki 标签值不能为空");
      if (tagCode && tagValue && tagCodes.has(tagCode)) {
        const tagKey = `${tagCode}:${tagValue}`;
        if (seenTags.has(tagKey)) {
          issue(issues, tagPath, "标签重复");
        } else {
          seenTags.add(tagKey);
          tags.push({ tagCode: tagCode as RecipeImportTagDraft["tagCode"], tagValue });
        }
      }
    }
  }

  const assistant = isRecord(wiki?.assistant) ? wiki.assistant : null;
  if (needsAssistant && !assistant) {
    issue(issues, `${path}.wiki.assistant`, "必须填写 assistant 对象");
  }
  const assistantSteps: RecipeImportAssistantStepDraft[] = [];
  if (needsAssistant && assistant) {
    assertKnownKeys(assistant, new Set(["steps"]), `${path}.wiki.assistant`, issues);
    if (!Array.isArray(assistant.steps) || assistant.steps.length === 0) {
      issue(issues, `${path}.wiki.assistant.steps`, "至少需要一条助理步骤");
    } else {
      for (const [index, rawStep] of assistant.steps.entries()) {
        const stepPath = `${path}.wiki.assistant.steps.${index}`;
        if (!isRecord(rawStep)) {
          issue(issues, stepPath, "助理步骤必须是对象");
          continue;
        }
        const allowed = new Set(["order", "phase", "action", "title", "detail", "imageUrl", "imagePrompt", "durationMinutes", "durationText"]);
        assertKnownKeys(rawStep, allowed, stepPath, issues);
        const order = rawStep.order;
        const phase = typeof rawStep.phase === "string" ? rawStep.phase : "";
        const action = typeof rawStep.action === "string" ? rawStep.action : "";
        const title = typeof rawStep.title === "string" ? rawStep.title.trim() : "";
        const detail = typeof rawStep.detail === "string" ? rawStep.detail.trim() : "";
        const imageUrl = rawStep.imageUrl === null || typeof rawStep.imageUrl === "string" ? rawStep.imageUrl : null;
        const imagePrompt = rawStep.imagePrompt === null || typeof rawStep.imagePrompt === "string" ? rawStep.imagePrompt : null;
        const durationMinutes = rawStep.durationMinutes === null
          ? null
          : Number.isInteger(rawStep.durationMinutes)
            ? Number(rawStep.durationMinutes)
            : null;
        const durationText = rawStep.durationText === null || typeof rawStep.durationText === "string" ? rawStep.durationText : null;
        if (!Number.isInteger(order) || Number(order) < 1) issue(issues, `${stepPath}.order`, "步骤序号必须为正整数");
        if (!phases.has(phase as RecipeImportAssistantPhase)) issue(issues, `${stepPath}.phase`, "助理阶段不支持");
        if (!actions.has(action as RecipeImportAssistantAction)) issue(issues, `${stepPath}.action`, "助理动作不支持");
        if (!title) issue(issues, `${stepPath}.title`, "助理步骤标题不能为空");
        if (!detail) issue(issues, `${stepPath}.detail`, "助理步骤说明不能为空");
        assistantSteps.push({
          order: Number(order),
          phase: phase as RecipeImportAssistantPhase,
          action: action as RecipeImportAssistantAction,
          title,
          detail,
          imageUrl,
          imagePrompt,
          durationMinutes,
          durationText
        });
      }
    }
  }

  const recipeContent = isRecord(value.recipeContent) ? value.recipeContent : null;
  for (const field of selectedFields) {
    if (field === "tags" || field === "assistant.steps") continue;
    if (!recipeContent || !Object.prototype.hasOwnProperty.call(recipeContent, field)) {
      issue(issues, `${path}.recipe.content.${field}`, "所选字段在文件中缺失");
    }
  }

  if (!Number.isInteger(recipeId) || Number(recipeId) < 1 || !Number.isInteger(contentVersionId) || Number(contentVersionId) < 1) return null;
  return {
    recipeId: Number(recipeId),
    contentVersionId: Number(contentVersionId),
    tags,
    assistantSteps,
    recipeContent
  };
}

export function parseRecipeWikiDocument(
  document: unknown,
  selectedFields: ReadonlySet<RecipeWikiReplaceField> = new Set(["tags", "assistant.steps"])
): RecipeWikiDocumentResult {
  const issues: RecipeImportIssue[] = [];
  if (!isRecord(document)) {
    issue(issues, null, "Wiki JSON 根必须是对象");
    return { items: [], invalidItems: [], issues };
  }
  const schemaVersion = document.schemaVersion;
  if (schemaVersion === "recipe.import.v1") {
    const recipe = isRecord(document.recipe) ? document.recipe : null;
    if (!recipe) {
      issue(issues, "recipe", "必须填写 recipe 对象");
      return { items: [], invalidItems: [], issues };
    }
    const item = parseItem({
      recipeId: recipe.recipeId,
      contentVersionId: recipe.contentVersionId,
      wiki: document.wiki,
      recipeContent: recipe.content
    }, "recipe", issues, selectedFields);
    return { items: item ? [item] : [], invalidItems: [], issues };
  }
  if (schemaVersion === "recipe.import.batch.v1") {
    if (!Array.isArray(document.recipes) || document.recipes.length === 0) {
      issue(issues, "recipes", "批量导入文件至少需要一条菜谱");
      return { items: [], invalidItems: [], issues };
    }
    const items: RecipeWikiImportItem[] = [];
    const invalidItems: RecipeWikiDocumentResult["invalidItems"] = [];
    document.recipes.forEach((rawItem, index) => {
      const path = `recipes.${index}`;
      if (!isRecord(rawItem)) {
        issue(issues, path, "菜谱条目必须是对象");
        return;
      }
      const recipe = isRecord(rawItem.recipe) ? rawItem.recipe : null;
      if (!recipe) {
        issue(issues, `${path}.recipe`, "必须填写 recipe 对象");
        return;
      }
      const itemIssues: RecipeImportIssue[] = [];
      const parsed = parseItem({
        recipeId: recipe.recipeId,
        contentVersionId: recipe.contentVersionId,
        wiki: rawItem.wiki,
        recipeContent: recipe.content
      }, path, itemIssues, selectedFields);
      const recipeId = Number.isInteger(recipe.recipeId) && Number(recipe.recipeId) > 0 ? Number(recipe.recipeId) : null;
      if (itemIssues.length && recipeId !== null) invalidItems.push({ recipeId, issues: itemIssues });
      else if (parsed) items.push(parsed);
      else issues.push(...itemIssues);
    });
    return { items, invalidItems, issues };
  }
  if (schemaVersion === "recipe.wiki.v1") {
    assertKnownKeys(document, new Set(["schemaVersion", "recipeId", "contentVersionId", "wiki"]), "", issues);
    const item = parseItem({ recipeId: document.recipeId, contentVersionId: document.contentVersionId, wiki: document.wiki }, "recipe", issues, selectedFields);
    return { items: item ? [item] : [], invalidItems: [], issues };
  }
  if (schemaVersion === "recipe.wiki.batch.v1") {
    assertKnownKeys(document, new Set(["schemaVersion", "recipes"]), "", issues);
    if (!Array.isArray(document.recipes) || document.recipes.length === 0) {
      issue(issues, "recipes", "批量 Wiki JSON 至少需要一条菜谱");
      return { items: [], invalidItems: [], issues };
    }
    const items: RecipeWikiImportItem[] = [];
    const invalidItems: RecipeWikiDocumentResult["invalidItems"] = [];
    document.recipes.forEach((item, index) => {
      const itemIssues: RecipeImportIssue[] = [];
      const parsed = parseItem(item, `recipes.${index}`, itemIssues, selectedFields);
      const recipeId = isRecord(item) && Number.isInteger(item.recipeId) && Number(item.recipeId) > 0 ? Number(item.recipeId) : null;
      if (itemIssues.length && recipeId !== null) invalidItems.push({ recipeId, issues: itemIssues });
      else if (parsed) items.push(parsed);
      else issues.push(...itemIssues);
    });
    return { items, invalidItems, issues };
  }
  issue(issues, "schemaVersion", "必须使用 recipe.import.v1、recipe.import.batch.v1、recipe.wiki.v1 或 recipe.wiki.batch.v1");
  return { items: [], invalidItems: [], issues };
}
