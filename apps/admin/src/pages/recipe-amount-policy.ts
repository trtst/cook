type ExactAmount = {
  kind: "EXACT";
  quantity: string;
  unitId: number | "";
};

type FuzzyAmount = {
  kind: "FUZZY";
  text: "适量";
};

export type RecipeIngredientAmountRow = {
  ingredientId: number | "";
  amount: ExactAmount | FuzzyAmount;
};

export function canUseFuzzyAmount(categoryCode: string | null | undefined) {
  return true;
}

export function applyRecipeIngredientCategory(
  row: RecipeIngredientAmountRow,
  categoryCode: string | null | undefined,
  defaultUnitId: number | ""
) {
  if (row.amount.kind !== "FUZZY" || canUseFuzzyAmount(categoryCode)) return;
  row.amount = {
    kind: "EXACT",
    quantity: "",
    unitId: defaultUnitId
  };
}
