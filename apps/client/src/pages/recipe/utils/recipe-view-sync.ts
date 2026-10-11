export type RecipeHomeTab = "my" | "inspiration" | "saved";
export type RecipeManageMode = "recipes" | "drafts" | "saved";
export type RecipeViewScope =
  | "home-my"
  | "home-inspiration"
  | "home-saved"
  | "manage-recipes"
  | "manage-drafts"
  | "manage-saved";

const viewVersions: Record<RecipeViewScope, number> = {
  "home-my": 0,
  "home-inspiration": 0,
  "home-saved": 0,
  "manage-recipes": 0,
  "manage-drafts": 0,
  "manage-saved": 0
};

function bumpView(scope: RecipeViewScope) {
  viewVersions[scope] += 1;
}

export function getRecipeViewVersion(scope: RecipeViewScope) {
  return viewVersions[scope];
}

export function markRecipeHomeDirty(tabs: RecipeHomeTab[] = ["my", "inspiration", "saved"]) {
  tabs.forEach(tab => {
    if (tab === "my") {
      bumpView("home-my");
      return;
    }
    if (tab === "inspiration") {
      bumpView("home-inspiration");
      return;
    }
    if (tab === "saved") bumpView("home-saved");
  });
}

export function markRecipeManageDirty(modes: RecipeManageMode[] = ["recipes", "drafts", "saved"]) {
  modes.forEach(mode => {
    if (mode === "recipes") {
      bumpView("manage-recipes");
      return;
    }
    if (mode === "drafts") {
      bumpView("manage-drafts");
      return;
    }
    bumpView("manage-saved");
  });
}
