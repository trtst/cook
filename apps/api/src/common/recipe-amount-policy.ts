export const fuzzyAmountCategoryMessage = "仅调味料可使用“适量”";

export function canUseFuzzyAmount(categoryCode: string | null | undefined) {
  return categoryCode === "SEASONING";
}
