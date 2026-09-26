export type IngredientRowPolicyState = {
  ingredientId: number | "";
  name: string;
  quantity: string;
  unitId: number | "";
  fuzzyText: "适量" | "";
  categoryId: number | "";
  categoryCode: string;
  defaultUnitId: number | "";
  source: "SYSTEM" | "PERSONAL" | "";
};

export type IngredientSelectionState = {
  id: number;
  name: string;
  categoryId: number;
  categoryCode: string;
  defaultUnitId: number;
  source: "SYSTEM" | "PERSONAL";
};

export function chooseFuzzyAmount(row: IngredientRowPolicyState) {
  row.quantity = "";
  row.unitId = "";
  row.fuzzyText = "适量";
  return true;
}

export function applyIngredientSelection(row: IngredientRowPolicyState, ingredient: IngredientSelectionState) {
  const isSameIngredient = row.ingredientId === ingredient.id;
  const hadFuzzyAmount = Boolean(row.fuzzyText);
  row.ingredientId = ingredient.id;
  row.name = ingredient.name;
  row.categoryId = ingredient.categoryId;
  row.categoryCode = ingredient.categoryCode;
  row.defaultUnitId = ingredient.defaultUnitId;
  row.source = ingredient.source;

  if (hadFuzzyAmount) return;
  if (!hadFuzzyAmount && isSameIngredient) return;
  row.quantity = "";
  row.fuzzyText = "";
  row.unitId = ingredient.defaultUnitId;
}
