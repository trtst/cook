import type { UUID } from "@/apis/http";
import { uniPlatform } from "@/platform/uni";
import type { ShoppingListDetail } from "../apis/shopping";

export type ShoppingCompleteSource = "list" | "detail";

const LIST_RESULT_KEY = "pantry_complete_result_list";
const DETAIL_RESULT_KEY_PREFIX = "pantry_complete_result_detail_";

function buildDetailResultKey(listId: UUID) {
  return `${DETAIL_RESULT_KEY_PREFIX}${String(listId)}`;
}

export function buildShoppingCompletePagePath(listId: UUID, source: ShoppingCompleteSource) {
  return `/pages_pantry/list-complete/index?id=${encodeURIComponent(String(listId))}&from=${encodeURIComponent(source)}`;
}

export function stashShoppingCompleteResult(source: ShoppingCompleteSource, detail: ShoppingListDetail) {
  const key = source === "list" ? LIST_RESULT_KEY : buildDetailResultKey(detail.id);
  uniPlatform.storage.setSync(key, detail);
}

export function consumeShoppingCompleteResult(source: ShoppingCompleteSource, listId?: UUID | "") {
  const key = source === "list"
    ? LIST_RESULT_KEY
    : listId
      ? buildDetailResultKey(listId)
      : "";
  if (!key) return null;
  const detail = uniPlatform.storage.getSync<ShoppingListDetail>(key);
  if (detail) {
    uniPlatform.storage.removeSync(key);
  }
  return detail;
}
