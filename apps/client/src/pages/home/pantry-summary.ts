import type { FridgeTraceSummaryResponse } from "@/apis/fridge";
import type { ShoppingListSummaryResponse } from "@/apis/shopping";

export interface PantrySummaryState {
  ingredientCount: number;
  traceCount: number;
  pendingShoppingCount: number;
  activeListCount: number;
}

export function createEmptyPantrySummary(): PantrySummaryState {
  return {
    ingredientCount: 0,
    traceCount: 0,
    pendingShoppingCount: 0,
    activeListCount: 0
  };
}

export function buildPantrySummaryState(
  fridgeSummary: FridgeTraceSummaryResponse | null,
  shoppingSummary: ShoppingListSummaryResponse | null
): PantrySummaryState {
  const next = createEmptyPantrySummary();
  if (fridgeSummary) {
    next.ingredientCount = fridgeSummary.totalCount;
    next.traceCount = fridgeSummary.totalCount;
  }
  if (shoppingSummary) {
    next.pendingShoppingCount = Math.max(shoppingSummary.pendingItemCount, 0);
    next.activeListCount = Math.max(shoppingSummary.activeListCount, 0);
  }
  return next;
}

export function hasPantrySummaryData(summary: PantrySummaryState) {
  return summary.ingredientCount > 0 || summary.pendingShoppingCount > 0 || summary.activeListCount > 0;
}

export function buildPantrySummaryHint(summary: PantrySummaryState) {
  if (summary.pendingShoppingCount > 0) {
    return summary.activeListCount > 0
      ? `${summary.activeListCount} 张清单还在采购中`
      : `${summary.pendingShoppingCount} 项还等着补齐`;
  }
  if (summary.traceCount > 0) {
    return `最近记录了 ${summary.traceCount} 样食材`;
  }
  if (summary.ingredientCount > 0) {
    return summary.activeListCount > 0
      ? `冰箱和 ${summary.activeListCount} 张清单的数据都在这里`
      : "冰箱里已经有食材记录了";
  }
  if (summary.activeListCount > 0) {
    return `${summary.activeListCount} 张清单还在整理中`;
  }
  return "开始记录购物和食材后会显示在这里。";
}
