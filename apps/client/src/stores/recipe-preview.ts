import { defineStore } from "pinia";
import type { UUID } from "@/apis/http";
import type { IngredientSource, RecipeDifficulty, RecipeDuration, RecipeStepSnapshot, UnitType } from "@/apis/recipe";

export interface RecipePreviewAmount {
  kind: "EXACT" | "FUZZY";
  quantity?: string;
  unitId?: UUID | "";
  unitName?: string;
  unitType?: UnitType;
  text?: "适量" | "少许" | "按需";
}

export interface RecipePreviewIngredient {
  ingredientId: UUID | "";
  ingredientName: string;
  source: IngredientSource | "";
  categoryId: UUID | "";
  amount: RecipePreviewAmount;
}

export interface RecipePreviewDetail {
  title: string;
  categoryName: string | null;
  sceneNames: string[];
  content: {
    story: string | null;
    baseServings: number | null;
    difficulty: RecipeDifficulty | null;
    duration: RecipeDuration | null;
    tips: string | null;
    ingredients: RecipePreviewIngredient[];
    steps: RecipeStepSnapshot[];
  };
}

export const useRecipePreviewStore = defineStore("recipe-preview", {
  state: () => ({
    detail: null as RecipePreviewDetail | null
  }),
  actions: {
    setPreview(detail: RecipePreviewDetail) {
      this.detail = detail;
    },
    clearPreview() {
      this.detail = null;
    }
  }
});
