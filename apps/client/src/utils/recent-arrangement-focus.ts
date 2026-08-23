import type { HomeRecentArrangement, HomeRecentArrangementStatus } from "../apis/home";

export type RecentArrangementFocus = "menu" | "footer" | "shopping" | "assistant" | "memory";
export type DetailFocus = "" | RecentArrangementFocus;

export const recentArrangementFocusTargets: Record<RecentArrangementFocus, string> = {
  menu: "meal-menu-panel",
  footer: "meal-footer-panel",
  shopping: "meal-shopping-panel",
  assistant: "meal-assistant-panel",
  memory: "meal-memory-panel"
};

export function resolveRecentArrangementFocus(status: HomeRecentArrangementStatus): RecentArrangementFocus {
  if (status === "EMPTY_MENU") return "menu";
  if (status === "PENDING_CONFIRM") return "footer";
  if (status === "PENDING_SHOPPING") return "shopping";
  if (status === "READY_TO_COOK") return "assistant";
  return "memory";
}

export function buildRecentArrangementDetailUrl(
  item: Pick<HomeRecentArrangement, "eventId" | "planDate" | "planItemId">,
  focus?: RecentArrangementFocus
) {
  const query = [
    `planItemId=${encodeURIComponent(String(item.planItemId))}`,
    `planDate=${encodeURIComponent(item.planDate)}`
  ];
  if (item.eventId) {
    query.push(`eventId=${encodeURIComponent(String(item.eventId))}`);
  }
  if (focus) {
    query.push(`focus=${encodeURIComponent(focus)}`);
  }
  return `/pages_meal/detail/index?${query.join("&")}`;
}

export function parseRecentArrangementDetailFocus(value: unknown): DetailFocus {
  if (typeof value !== "string") return "";
  const text = decodeURIComponent(value).trim();
  if (text === "menu" || text === "footer" || text === "shopping" || text === "assistant" || text === "memory") {
    return text;
  }
  return "";
}

export function resolveRecentArrangementFocusTargetId(
  focus: RecentArrangementFocus,
  options: {
    hasEventDetail: boolean;
    hasPlanDetail: boolean;
    showShoppingPanel: boolean;
  }
) {
  if (focus === "shopping" && !options.showShoppingPanel) return "";
  if (focus === "memory" && !options.hasEventDetail) return "";
  if (focus === "assistant" && !options.hasPlanDetail) return "";
  return recentArrangementFocusTargets[focus];
}
