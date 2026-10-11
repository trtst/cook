export type RecipeImagePosition =
  | { type: "COVER" }
  | { type: "STEP" | "WIKI_STEP"; order: number };

export function recipeImageFileName(recipeId: string | number, contentVersionId: string | number, position: RecipeImagePosition, extension: string) {
  const recipeKey = String(recipeId);
  const versionKey = String(contentVersionId);
  if (!/^\d+$/.test(recipeKey) || !/^\d+$/.test(versionKey)) {
    throw new Error("菜谱图片 ID 或内容版本 ID 无效");
  }
  const suffix = position.type === "COVER"
    ? ""
    : (Number.isInteger(position.order) && position.order > 0
        ? position.type === "STEP" ? `_step-${position.order}` : `_wiki-step-${position.order}`
        : null);
  if (suffix === null) throw new Error("菜谱图片步骤序号无效");
  return `${recipeKey}_${versionKey}${suffix}.${extension}`;
}
