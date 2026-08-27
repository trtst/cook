const preferGramNames = new Set([
  "番茄",
  "土豆",
  "青椒",
  "白菜",
  "生菜",
  "黄瓜",
  "胡萝卜",
  "茄子",
  "西兰花",
  "洋葱",
  "大葱",
  "苹果",
  "香蕉",
  "橙子",
  "柠檬",
  "梨",
  "豆腐泡",
  "速冻饺子",
  "速冻馄饨",
  "丸子"
]);

const preferMilliliterNames = new Set([
  "酸奶",
  "啤酒",
  "红酒",
  "洋酒",
  "清酒",
  "威士忌",
  "朗姆酒",
  "伏特加",
  "金酒",
  "白兰地"
]);

export type RecommendedIngredientUnitName = "克" | "毫升" | null;

export function resolveRecommendedIngredientUnitName(name: string): RecommendedIngredientUnitName {
  const normalizedName = name.trim();
  if (!normalizedName) return null;
  if (preferGramNames.has(normalizedName)) return "克";
  if (preferMilliliterNames.has(normalizedName)) return "毫升";
  return null;
}

export function buildIngredientUnitHint(name: string, selectedUnitName: string): string {
  const recommendedUnitName = resolveRecommendedIngredientUnitName(name);
  if (!recommendedUnitName || !selectedUnitName || selectedUnitName === recommendedUnitName) {
    return "";
  }
  return `按当前食材规则，建议默认单位使用“${recommendedUnitName}”，本次仍可继续提交。`;
}
