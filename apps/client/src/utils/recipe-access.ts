export type RecipeAccessKind = "my" | "inspiration";

export function defaultRecipeTab(isLoggedIn: boolean): RecipeAccessKind {
  return isLoggedIn ? "my" : "inspiration";
}

export function canReadRecipe(kind: RecipeAccessKind, isLoggedIn: boolean) {
  return kind === "inspiration" || kind === "my" || isLoggedIn;
}
