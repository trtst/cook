import type { FridgeTraceSummary } from "../apis/fridge";

type FridgeTracePageLoader = (page: number, pageSize: number) => Promise<{
  items: FridgeTraceSummary[];
  hasNext: boolean;
}>;

export async function loadAllFridgeTraces(loadPage: FridgeTracePageLoader) {
  const items: FridgeTraceSummary[] = [];
  let page = 1;
  let hasNext = true;

  while (hasNext) {
    const result = await loadPage(page, 100);
    items.push(...result.items);
    hasNext = result.hasNext;
    page += 1;
  }

  return items;
}
