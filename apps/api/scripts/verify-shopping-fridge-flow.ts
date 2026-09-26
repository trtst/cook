import { loadLocalEnv } from "../src/common/load-env";
import { loginWithPassword } from "./auth-fixture";
import type {
  FridgeTraceIngredientSummary,
  PageResult,
  ShoppingListDetail,
  ShoppingListItemPatchResponse,
  ShoppingListSummaryResponse
} from "../src/contracts/types";

loadLocalEnv();

const apiBaseUrl = process.env.API_BASE_URL ?? "http://127.0.0.1:3100/api";
const ownerPhone = process.env.TEST_OWNER_PHONE ?? "13800000000";
const password = process.env.TEST_USER_PASSWORD ?? "change-me";
let idempotencySeed = BigInt(Date.now()) * 1_000_000n + BigInt(process.pid) * 1_000n;

interface ApiEnvelope<T> {
  code: number;
  message: string;
  data: T;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function nextIdempotencyKey() {
  idempotencySeed += 1n;
  return idempotencySeed.toString();
}

function withIdempotencyKey(headers: Record<string, string>) {
  return { ...headers, "Idempotency-Key": nextIdempotencyKey() };
}

async function requestData<T>(path: string, options: RequestInit = {}) {
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
  assert(response.ok, `${path} HTTP ${response.status}: ${body.message}`);
  assert(body.code === 0, `${path} code ${body.code}: ${body.message}`);
  return body.data;
}

async function main() {
  const owner = await loginWithPassword(requestData, ownerPhone, password);
  const ownerAuth = { authorization: `Bearer ${owner.token}` };
  const summaryBefore = await requestData<ShoppingListSummaryResponse>("/shopping-lists/summary", { headers: ownerAuth });
  const list = await requestData<ShoppingListDetail>("/shopping-lists", {
    method: "POST",
    headers: withIdempotencyKey(ownerAuth),
    body: JSON.stringify({ name: `轻量采购验收-${nextIdempotencyKey().slice(-6)}` })
  });
  const itemName = `按需食材-${nextIdempotencyKey().slice(-6)}`;
  const withItem = await requestData<ShoppingListDetail>(`/shopping-lists/${list.id}/items`, {
    method: "POST",
    headers: withIdempotencyKey(ownerAuth),
    body: JSON.stringify({ name: itemName, quantityText: null, note: null })
  });
  const item = withItem.items.find(candidate => candidate.name === itemName);
  assert(item, "manual shopping item should be present");
  assert(item.quantityText === null, "manual item should not require a quantity");

  const checked = await requestData<ShoppingListItemPatchResponse>(`/shopping-lists/${list.id}/items/${item.id}/check`, {
    method: "POST",
    headers: withIdempotencyKey(ownerAuth),
    body: JSON.stringify({ version: withItem.version, checked: true })
  });
  assert(checked.item?.status === "CHECKED", "checking should mark the shopping item bought");

  const traces = await requestData<PageResult<FridgeTraceIngredientSummary>>("/fridge-traces?page=1&pageSize=100", {
    headers: ownerAuth
  });
  const purchased = traces.items.find(trace => trace.name === itemName);
  assert(purchased?.presence === "PRESENT", "checking as bought should create a present trace");
  assert(purchased.recentlyPurchased, "newly purchased ingredient should show its recent-purchase trace");

  const unchecked = await requestData<ShoppingListItemPatchResponse>(`/shopping-lists/${list.id}/items/${item.id}/check`, {
    method: "POST",
    headers: withIdempotencyKey(ownerAuth),
    body: JSON.stringify({ version: checked.version, checked: false })
  });
  assert(unchecked.item?.status === "OPEN", "unchecking should return the item to the buy list");

  const summaryAfter = await requestData<ShoppingListSummaryResponse>("/shopping-lists/summary", { headers: ownerAuth });
  assert(summaryAfter.activeListCount >= summaryBefore.activeListCount + 1, "active list should remain in the shopping summary");
  console.log(JSON.stringify({ listId: list.id, itemId: item.id, presentTrace: purchased.presence, checked: checked.item.status }));
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
