export type RecipeHomeTab = "my" | "inspiration" | "collection";
export type RecipeManageMode = "recipes" | "drafts";
export type RecipeViewScope =
  | "home-my"
  | "home-inspiration"
  | "home-collection"
  | "manage-recipes"
  | "manage-drafts";

const viewVersions: Record<RecipeViewScope, number> = {
  "home-my": 0,
  "home-inspiration": 0,
  "home-collection": 0,
  "manage-recipes": 0,
  "manage-drafts": 0
};

function bumpView(scope: RecipeViewScope) {
  viewVersions[scope] += 1;
}

export function getRecipeViewVersion(scope: RecipeViewScope) {
  return viewVersions[scope];
}

export function markRecipeHomeDirty(tabs: RecipeHomeTab[] = ["my", "inspiration", "collection"]) {
  tabs.forEach((tab) => {
    if (tab === "my") {
      bumpView("home-my");
      return;
    }
    if (tab === "inspiration") {
      bumpView("home-inspiration");
      return;
    }
    bumpView("home-collection");
  });
}

export function markRecipeManageDirty(modes: RecipeManageMode[] = ["recipes", "drafts"]) {
  modes.forEach((mode) => {
    if (mode === "recipes") {
      bumpView("manage-recipes");
      return;
    }
    bumpView("manage-drafts");
  });
}
