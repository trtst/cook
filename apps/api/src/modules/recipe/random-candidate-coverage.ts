import type { RecipeSlotType } from "../../contracts/types";

type RandomCandidateMealSlot = "BREAKFAST" | "LUNCH" | "DINNER";

export const requiredRandomCandidateCoverage = [
  { mealSlot: "BREAKFAST", slotType: "BREAKFAST_STAPLE", key: "BREAKFAST:BREAKFAST_STAPLE" },
  { mealSlot: "BREAKFAST", slotType: "BREAKFAST_PROTEIN", key: "BREAKFAST:BREAKFAST_PROTEIN" },
  { mealSlot: "BREAKFAST", slotType: "BREAKFAST_SIDE", key: "BREAKFAST:BREAKFAST_SIDE" },
  { mealSlot: "LUNCH", slotType: "MEAT", key: "LUNCH:MEAT" },
  { mealSlot: "LUNCH", slotType: "VEGETABLE", key: "LUNCH:VEGETABLE" },
  { mealSlot: "LUNCH", slotType: "SOUP", key: "LUNCH:SOUP" },
  { mealSlot: "LUNCH", slotType: "STAPLE", key: "LUNCH:STAPLE" },
  { mealSlot: "DINNER", slotType: "MEAT", key: "DINNER:MEAT" },
  { mealSlot: "DINNER", slotType: "VEGETABLE", key: "DINNER:VEGETABLE" },
  { mealSlot: "DINNER", slotType: "SOUP", key: "DINNER:SOUP" },
  { mealSlot: "DINNER", slotType: "STAPLE", key: "DINNER:STAPLE" }
] as const;

export const requiredRandomCandidateSlotTypes: RecipeSlotType[] = Array.from(
  new Set(requiredRandomCandidateCoverage.map(item => item.slotType))
);

export function slotTypesFromConfirmedRecipeTags(tags: Array<{ tagCode: string; tagValue: string }>) {
  const values = new Map<string, string[]>();
  for (const tag of tags) {
    values.set(tag.tagCode, [...(values.get(tag.tagCode) ?? []), tag.tagValue]);
  }
  const mealTypes = new Set(values.get("MEAL_TYPE") ?? []);
  const dishRoles = new Set(values.get("DISH_ROLE") ?? []);
  const proteinTypes = new Set(values.get("MAIN_PROTEIN_TYPE") ?? []);
  if (!mealTypes.size || !dishRoles.size) return [] as RecipeSlotType[];

  if ([...mealTypes].every(item => item === "BREAKFAST")) {
    if (dishRoles.has("STAPLE")) return ["BREAKFAST_STAPLE"];
    if (proteinTypes.size) return ["BREAKFAST_PROTEIN"];
    return ["BREAKFAST_SIDE"];
  }

  const slotTypes: RecipeSlotType[] = [];
  if (dishRoles.has("MAIN")) slotTypes.push("MEAT");
  if (dishRoles.has("VEGETABLE")) slotTypes.push("VEGETABLE");
  if (dishRoles.has("SOUP")) slotTypes.push("SOUP");
  if (dishRoles.has("STAPLE")) slotTypes.push("STAPLE");
  return slotTypes;
}

export function candidateCoverageKeysFromConfirmedRecipeTags(tags: Array<{ tagCode: string; tagValue: string }>) {
  const mealTypes = new Set(tags.filter(tag => tag.tagCode === "MEAL_TYPE").map(tag => tag.tagValue));
  return Array.from(mealTypes)
    .filter((mealSlot): mealSlot is RandomCandidateMealSlot => mealSlot === "BREAKFAST" || mealSlot === "LUNCH" || mealSlot === "DINNER")
    .flatMap(mealSlot => {
      const scopedTags = tags.map(tag => tag.tagCode === "MEAL_TYPE" ? { ...tag, tagValue: mealSlot } : tag);
      return slotTypesFromConfirmedRecipeTags(scopedTags).map(slotType => `${mealSlot}:${slotType}`);
    });
}

export function missingRandomCandidateSlotTypes(counts: ReadonlyMap<string, number>) {
  return requiredRandomCandidateCoverage
    .map(item => item.key)
    .filter(key => (counts.get(key) ?? 0) === 0);
}
