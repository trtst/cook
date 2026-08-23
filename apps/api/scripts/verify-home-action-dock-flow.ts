import { loadLocalEnv } from "../src/common/load-env";
import type { HomeEntriesResponse, HomeEntryItem } from "../src/contracts/types";

loadLocalEnv();

const apiBaseUrl = process.env.API_BASE_URL ?? "http://127.0.0.1:3100/api";
const featurePlacements = ["MAIN", "SIDE_TOP", "SIDE_BOTTOM"] as const;
const quickPlacements = ["QUICK_1", "QUICK_2", "QUICK_3", "QUICK_4"] as const;

interface ApiEnvelope<T> {
  code: number;
  message: string;
  data: T;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function request<T>(path: string, options: RequestInit = {}) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      "x-cook-from": "mini_program",
      "x-cook-version": "0.1.0",
      ...options.headers
    }
  });
  const body = (await response.json()) as ApiEnvelope<T>;
  return { status: response.status, body };
}

async function requestData<T>(path: string, options: RequestInit = {}) {
  const result = await request<T>(path, options);
  assert(result.status >= 200 && result.status < 300, `${path} HTTP ${result.status}: ${result.body.message}`);
  assert(result.body.code === 0, `${path} code ${result.body.code}: ${result.body.message}`);
  return result.body.data;
}

function assertTargetShape(item: HomeEntryItem) {
  if (item.targetType === "PAGE") {
    assert(
      /^\/pages(?:_|\/)/.test(item.targetValue),
      `${item.placement} page target should stay inside mini-program pages: ${item.targetValue}`
    );
    return;
  }
  assert(/^https:\/\//.test(item.targetValue), `${item.placement} web-view target should use https: ${item.targetValue}`);
}

async function main() {
  const entries = await requestData<HomeEntriesResponse>("/home-entries");
  assert(entries.items.length >= 3, "home entries should always return the three feature placements");
  assert(entries.items.length <= 7, "home entries should never exceed the seven configured placements");

  const placementOrder = new Map(
    [...featurePlacements, ...quickPlacements].map((placement, index) => [placement, index] as const)
  );
  const ids = new Set<string>();
  const placements = new Set<string>();

  entries.items.forEach((item, index) => {
    assert(item.title.trim().length > 0, `${item.placement} title should not be empty`);
    assert(!ids.has(item.id), `home entry id should be unique: ${item.id}`);
    assert(!placements.has(item.placement), `home entry placement should be unique: ${item.placement}`);
    ids.add(item.id);
    placements.add(item.placement);
    assertTargetShape(item);
    if (index > 0) {
      const previous = entries.items[index - 1]!;
      assert(
        (placementOrder.get(previous.placement) ?? -1) < (placementOrder.get(item.placement) ?? -1),
        "home entries should follow feature placements first, then quick placement order"
      );
    }
  });

  featurePlacements.forEach((placement, index) => {
    assert(entries.items[index]?.placement === placement, `feature placement ${placement} should stay in fixed order`);
  });

  const quickItems = entries.items.filter(item => quickPlacements.includes(item.placement as (typeof quickPlacements)[number]));
  assert(quickItems.length <= 4, "quick entry count should not exceed four");

  console.log(
    JSON.stringify(
      {
        apiBaseUrl,
        totalCount: entries.items.length,
        featurePlacements: entries.items.slice(0, 3).map(item => item.placement),
        quickPlacements: quickItems.map(item => item.placement),
        quickTitles: quickItems.map(item => item.title)
      },
      null,
      2
    )
  );
}

void main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
