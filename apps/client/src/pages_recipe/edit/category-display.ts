const COLLAPSED_CATEGORY_COUNT = 5;

export function buildCategoryDisplay<T>(items: readonly T[], expanded: boolean) {
  const hiddenCount = Math.max(items.length - COLLAPSED_CATEGORY_COUNT, 0);
  const showToggle = hiddenCount > 0;
  const isExpanded = showToggle && expanded;

  return {
    rows: items.map((item, index) => ({ item, extra: index >= COLLAPSED_CATEGORY_COUNT })),
    expanded: isExpanded,
    showToggle,
    toggleText: showToggle ? (isExpanded ? "收起分类" : `还有 ${hiddenCount} 个分类`) : ""
  };
}
