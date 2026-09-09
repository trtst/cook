import type {
  AdminRecipeWikiQualityCard,
  RecipeAssistantSnapshot,
  RecipeContentSnapshot,
  RecipeNutritionSummary
} from "../../contracts/types";

type WikiTag = {
  tagCode: string;
  tagValue: string;
  status: string;
};

type Check = {
  ok: boolean;
  reason: string;
};

const requiredTagCodes = ["MEAL_TYPE", "DISH_ROLE", "MAIN_PROTEIN_TYPE", "FLAVOR_PROFILE", "SPICE_LEVEL"];
const supportedMealTypes = new Set(["BREAKFAST", "LUNCH", "DINNER"]);
const supportedDishRoles = new Set(["MAIN", "VEGETABLE", "SOUP", "STAPLE"]);

function card(
  code: AdminRecipeWikiQualityCard["code"],
  title: string,
  checks: Check[]
): AdminRecipeWikiQualityCard {
  const passed = checks.filter(item => item.ok).length;
  const score = checks.length ? Math.round((passed / checks.length) * 100) : 0;
  return {
    code,
    title,
    status: score === 100 ? "COMPLETE" : "INCOMPLETE",
    score,
    blockingReasons: checks.filter(item => !item.ok).map(item => item.reason)
  };
}

function confirmedTags(tags: WikiTag[]) {
  return tags.filter(tag => tag.status === "CONFIRMED");
}

export function buildRecipeWikiQualityCards(input: {
  content: RecipeContentSnapshot;
  tags: WikiTag[];
  nutrition: RecipeNutritionSummary;
  assistant: RecipeAssistantSnapshot | null;
}) {
  const confirmed = confirmedTags(input.tags);
  const hasTag = (code: string) => confirmed.some(tag => tag.tagCode === code);
  const values = (code: string) => confirmed.filter(tag => tag.tagCode === code).map(tag => tag.tagValue);
  const exactIngredients = input.content.ingredients.length > 0 && input.content.ingredients.every(item => {
    return item.ingredientId > 0 && item.amount.kind === "EXACT" && item.amount.unitId > 0;
  });
  const validSteps = input.content.steps.length > 0 && input.content.steps.every(item => item.text.trim().length > 0);
  const contentComplete = [
    [Boolean(input.content.name.trim()), "缺少菜谱名称"],
    [Boolean(input.content.story?.trim()), "缺少故事或介绍"],
    [input.content.baseServings > 0, "缺少基准人数"],
    [Boolean(input.content.difficulty), "缺少难度"],
    [Boolean(input.content.duration), "缺少总时长"],
    [Boolean(input.content.tips?.trim()), "缺少做饭建议"],
    [exactIngredients, "食材或单位尚未完成结构化匹配"],
    [validSteps, "缺少有效制作步骤"]
  ].map(([ok, reason]) => ({ ok: Boolean(ok), reason: String(reason) }));

  const businessTagChecks = requiredTagCodes.map(code => ({
    ok: hasTag(code),
    reason: `缺少已确认的 ${code} 标签`
  }));
  const assistantReady = Boolean(
    input.assistant &&
    input.assistant.steps.length > 0 &&
    input.assistant.steps.every(step => step.durationMinutes !== null && Number.isInteger(step.durationMinutes) && step.durationMinutes > 0)
  );
  const randomMealReady = values("MEAL_TYPE").some(value => supportedMealTypes.has(value));
  const randomRoleReady = values("DISH_ROLE").some(value => supportedDishRoles.has(value));

  return [
    card("CONTENT", "正文完整度", contentComplete),
    card("STRUCTURED_DATA", "结构化数据", [
      { ok: exactIngredients, reason: "食材、数量或单位尚未完成严格匹配" },
      { ok: validSteps, reason: "制作步骤尚未结构化" },
      { ok: input.content.tools !== undefined, reason: "厨具字段缺失" }
    ]),
    card("BUSINESS_TAGS", "业务标签", businessTagChecks),
    card("NUTRITION", "营养分析", [
      { ok: input.nutrition.status === "COMPLETE", reason: input.nutrition.qualityLabel ?? "营养数据不足" }
    ]),
    card("ASSISTANT", "美食助理", [
      { ok: assistantReady, reason: "当前版本没有可用的完整助理步骤" }
    ]),
    card("FRONTEND_CONSUMPTION", "前台消费", [
      { ok: contentComplete.every(item => item.ok), reason: "正文仍有缺失项" },
      { ok: businessTagChecks.every(item => item.ok), reason: "业务标签尚未全部确认" },
      { ok: assistantReady, reason: "美食助理步骤尚未生成或缺少时长" }
    ]),
    card("RANDOM_MENU", "随机一桌", [
      { ok: randomMealReady, reason: "餐次不是当前随机一桌支持的餐次" },
      { ok: randomRoleReady, reason: "菜品角色不是当前随机一桌支持的菜位" },
      { ok: hasTag("MAIN_PROTEIN_TYPE"), reason: "主蛋白标签尚未确认" }
    ])
  ];
}
