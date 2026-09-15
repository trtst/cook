const COLLAPSED_MENU_COUNT = 5;

function buildCollapsedDisplay<T>(
  items: readonly T[],
  expanded: boolean,
  moreText: (count: number) => string,
  collapseText: string
) {
  const hiddenCount = Math.max(items.length - COLLAPSED_MENU_COUNT, 0);
  const showToggle = hiddenCount > 0;
  const isExpanded = showToggle && expanded;

  return {
    rows: items.map((item, index) => ({ item, extra: index >= COLLAPSED_MENU_COUNT })),
    expanded: isExpanded,
    showToggle,
    toggleText: showToggle ? (isExpanded ? collapseText : moreText(hiddenCount)) : ""
  };
}

export function buildMenuDisplay<T>(items: readonly T[], expanded: boolean) {
  return buildCollapsedDisplay(items, expanded, count => `还有 ${count} 道菜`, "收起菜单");
}

export function buildShoppingDisplay<T>(items: readonly T[], expanded: boolean) {
  return buildCollapsedDisplay(items, expanded, count => `还有 ${count} 样食材`, "收起采购清单");
}

export function menuItemMetaText(isDiningEvent: boolean, keywords: readonly string[], servings: number | null) {
  if (isDiningEvent) return keywords[0]?.trim() || "";
  return servings ? `${servings}人份` : "待安排";
}
