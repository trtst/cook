const COLLAPSED_INGREDIENT_COUNT = 5;

export function buildIngredientDisplay<T>(items: readonly T[], expanded: boolean) {
  const hiddenCount = Math.max(items.length - COLLAPSED_INGREDIENT_COUNT, 0);
  const showToggle = hiddenCount > 0;
  const isExpanded = showToggle && expanded;

  return {
    rows: items.map((item, index) => ({
      item,
      extra: index >= COLLAPSED_INGREDIENT_COUNT
    })),
    expanded: isExpanded,
    showToggle,
    toggleText: showToggle ? (isExpanded ? "收起食材清单" : `还有 ${hiddenCount} 样食材`) : ""
  };
}
