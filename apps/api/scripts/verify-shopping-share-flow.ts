import { loadLocalEnv } from "../src/common/load-env";
import { loginWithPassword } from "./auth-fixture";
import type {
  IngredientSummary,
  PageResult,
  ShareShoppingListLinkResponse,
  ShoppingListDetail,
  ShoppingListPageResponse,
  ShoppingListSummaryResponse,
  ShoppingSharePreview
} from "../src/contracts/types";

loadLocalEnv();

const apiBaseUrl = process.env.API_BASE_URL ?? "http://127.0.0.1:3100/api";
const ownerPhone = process.env.TEST_OWNER_PHONE ?? "13800000000";
const memberPhone = process.env.TEST_MEMBER_PHONE ?? "13900000000";
const collaboratorPhone = process.env.TEST_COLLABORATOR_PHONE ?? "13700000000";
const password = process.env.TEST_USER_PASSWORD ?? "change-me";

interface ApiEnvelope<T> {
  code: number;
  message: string;
  data: T;
}

interface LoginUser {
  uid: number;
}

interface LoginResult {
  token: string;
  user: LoginUser;
}

let idempotencySeed =
  BigInt(Date.now()) * 1_000_000n +
  BigInt(process.pid) * 1_000n +
  BigInt(Math.floor(Math.random() * 1000));

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function nextIdempotencyKey() {
  idempotencySeed += 1n;
  return idempotencySeed.toString();
}

function withIdempotencyKey(headers: Record<string, string>, key = nextIdempotencyKey()) {
  return {
    ...headers,
    "Idempotency-Key": key
  };
}

function parseShareToken(shareUrl: string) {
  const url = new URL(shareUrl, "https://cook.local");
  const token = url.searchParams.get("shareToken");
  assert(token, "share url should contain shareToken");
  return token;
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

async function login(phone: string) {
  return loginWithPassword(requestData, phone, password);
}

async function resolveSystemIngredient(headers: Record<string, string>) {
  const page = await requestData<PageResult<IngredientSummary>>("/ingredients?page=1&pageSize=20&source=SYSTEM", {
    headers
  });
  assert(page.items.length > 0, "system ingredients should be readable");
  return page.items[0];
}

async function main() {
  const owner = await login(ownerPhone);
  const member = await login(memberPhone);
  const collaborator = await login(collaboratorPhone);
  const ownerAuth = { authorization: `Bearer ${owner.token}` };
  const memberAuth = { authorization: `Bearer ${member.token}` };
  const collaboratorAuth = { authorization: `Bearer ${collaborator.token}` };

  const summaryBefore = await requestData<ShoppingListSummaryResponse>("/shopping-lists/summary", {
    headers: ownerAuth
  });
  const activeBefore = summaryBefore.statuses.find(item => item.status === "ACTIVE")?.count ?? 0;

  const created = await requestData<ShoppingListDetail>("/shopping-lists", {
    method: "POST",
    headers: withIdempotencyKey(ownerAuth),
    body: JSON.stringify({
      name: `共享采购验收-${nextIdempotencyKey().slice(-6)}`
    })
  });
  assert(created.role === "OWNER", "created shopping list should belong to owner");
  assert(created.memberCount === 1, "created shopping list should start with owner only");

  const systemIngredient = await resolveSystemIngredient(ownerAuth);
  const withItem = await requestData<ShoppingListDetail>(`/shopping-lists/${created.id}/items`, {
    method: "POST",
    headers: withIdempotencyKey(ownerAuth),
    body: JSON.stringify({
      name: systemIngredient.name,
      ingredientId: systemIngredient.id,
      quantityText: `2${systemIngredient.defaultUnit.name}`,
      note: "共享脚本验收食材"
    })
  });
  assert(withItem.items.length >= 1, "shopping list should contain the created manual item");
  assert(withItem.items.some(item => item.ingredientId === systemIngredient.id), "shopping list should keep ingredient id");

  const summaryAfter = await requestData<ShoppingListSummaryResponse>("/shopping-lists/summary", {
    headers: ownerAuth
  });
  const activeAfter = summaryAfter.statuses.find(item => item.status === "ACTIVE")?.count ?? 0;
  assert(activeAfter >= activeBefore + 1, "shopping list summary should include the new active list");

  const shareOperationId = nextIdempotencyKey();
  const [shareA, shareB] = await Promise.all([
    requestData<ShareShoppingListLinkResponse>(`/shopping-lists/${withItem.id}/share-link`, {
      method: "POST",
      headers: withIdempotencyKey(ownerAuth, shareOperationId),
      body: JSON.stringify({ version: withItem.version })
    }),
    requestData<ShareShoppingListLinkResponse>(`/shopping-lists/${withItem.id}/share-link`, {
      method: "POST",
      headers: withIdempotencyKey(ownerAuth, shareOperationId),
      body: JSON.stringify({ version: withItem.version })
    })
  ]);
  assert(shareA.shareToken === shareB.shareToken, "share-link replay should return the same share token");
  const firstToken = parseShareToken(shareA.shareUrl);

  const guestPreview = await request<ShoppingSharePreview>(`/shopping-shares/${firstToken}`, {});
  assert(guestPreview.status === 200 && guestPreview.body.code === 401, "share preview should require login");

  const memberPreviewBeforeJoin = await requestData<ShoppingSharePreview>(`/shopping-shares/${firstToken}`, {
    headers: memberAuth
  });
  assert(memberPreviewBeforeJoin.joined === false, "member should not be joined before share join");
  assert(memberPreviewBeforeJoin.canJoin === true, "member should be able to join before share join");
  assert(memberPreviewBeforeJoin.itemCount >= 1, "preview should expose item count");

  const joinOperationId = nextIdempotencyKey();
  const [memberJoinA, memberJoinB] = await Promise.all([
    requestData<ShoppingListDetail>(`/shopping-shares/${firstToken}/join`, {
      method: "POST",
      headers: withIdempotencyKey(memberAuth, joinOperationId),
      body: JSON.stringify({})
    }),
    requestData<ShoppingListDetail>(`/shopping-shares/${firstToken}/join`, {
      method: "POST",
      headers: withIdempotencyKey(memberAuth, joinOperationId),
      body: JSON.stringify({})
    })
  ]);
  assert(memberJoinA.id === withItem.id, "joined list id should match the shared list");
  assert(memberJoinA.version === memberJoinB.version, "share join replay should be idempotent");
  assert(
    memberJoinA.collaborators.some(item => item.user.uid === member.user.uid && item.role === "COLLABORATOR"),
    "joined list should include the member collaborator"
  );

  const memberListPage = await requestData<ShoppingListPageResponse>("/shopping-lists?status=ACTIVE", {
    headers: memberAuth
  });
  assert(memberListPage.items.some(item => item.id === withItem.id && item.role === "COLLABORATOR"), "member should see the shared list");

  const memberDetailBeforeCopy = await requestData<ShoppingListDetail>(`/shopping-lists/${withItem.id}`, {
    headers: memberAuth
  });
  const memberCopy = await requestData<ShoppingListDetail>(`/shopping-lists/${withItem.id}/copy`, {
    method: "POST",
    headers: withIdempotencyKey(memberAuth),
    body: JSON.stringify({ version: memberDetailBeforeCopy.version })
  });
  assert(memberCopy.id !== withItem.id, "copy should create a new list");
  assert(memberCopy.role === "OWNER", "copied list should belong to the copying member");
  assert(memberCopy.items.length === memberJoinA.items.length, "copy should keep the item count");

  const ownerAfterMemberJoin = await requestData<ShoppingListDetail>(`/shopping-lists/${withItem.id}`, {
    headers: ownerAuth
  });
  assert(ownerAfterMemberJoin.memberCount === 2, "owner detail should show two collaborators after join");

  const memberDetailBeforeLeave = await requestData<ShoppingListDetail>(`/shopping-lists/${withItem.id}`, {
    headers: memberAuth
  });
  const memberLeavePage = await requestData<ShoppingListPageResponse>(`/shopping-lists/${withItem.id}/leave`, {
    method: "POST",
    headers: withIdempotencyKey(memberAuth),
    body: JSON.stringify({ version: memberDetailBeforeLeave.version })
  });
  assert(memberLeavePage.items.every(item => item.id !== withItem.id), "member should no longer see the shared list after leaving");

  const ownerAfterLeave = await requestData<ShoppingListDetail>(`/shopping-lists/${withItem.id}`, {
    headers: ownerAuth
  });
  assert(ownerAfterLeave.memberCount === 1, "owner detail should drop back to one member after collaborator leaves");

  const secondShare = await requestData<ShareShoppingListLinkResponse>(`/shopping-lists/${withItem.id}/share-link`, {
    method: "POST",
    headers: withIdempotencyKey(ownerAuth),
    body: JSON.stringify({ version: ownerAfterLeave.version })
  });
  const secondToken = parseShareToken(secondShare.shareUrl);
  assert(secondToken !== firstToken, "refreshing share link should issue a new token");

  const expiredFirstPreview = await request<ShoppingSharePreview>(`/shopping-shares/${firstToken}`, {
    headers: collaboratorAuth
  });
  assert(expiredFirstPreview.status === 200 && expiredFirstPreview.body.code === 404, "previous share token should expire after share-link refresh");

  const collaboratorPreview = await requestData<ShoppingSharePreview>(`/shopping-shares/${secondToken}`, {
    headers: collaboratorAuth
  });
  assert(collaboratorPreview.joined === false, "second collaborator should not be joined before using the new share link");
  assert(collaboratorPreview.canJoin === true, "second collaborator should be able to join with the new share link");

  const collaboratorJoin = await requestData<ShoppingListDetail>(`/shopping-shares/${secondToken}/join`, {
    method: "POST",
    headers: withIdempotencyKey(collaboratorAuth),
    body: JSON.stringify({})
  });
  assert(
    collaboratorJoin.collaborators.some(item => item.user.uid === collaborator.user.uid && item.role === "COLLABORATOR"),
    "joined list should include the second collaborator"
  );

  const ownerBeforeRemove = await requestData<ShoppingListDetail>(`/shopping-lists/${withItem.id}`, {
    headers: ownerAuth
  });
  const collaboratorMember = ownerBeforeRemove.collaborators.find(item => item.user.uid === collaborator.user.uid);
  assert(collaboratorMember, "owner detail should expose the joined collaborator member record");
  const removed = await requestData<ShoppingListDetail>(
    `/shopping-lists/${withItem.id}/members/${collaboratorMember.userId}/remove`,
    {
      method: "POST",
      headers: withIdempotencyKey(ownerAuth),
      body: JSON.stringify({ version: ownerBeforeRemove.version })
    }
  );
  assert(
    removed.collaborators.every(item => item.user.uid !== collaborator.user.uid),
    "owner remove should delete the selected collaborator"
  );

  const closed = await requestData<ShoppingListDetail>(`/shopping-lists/${withItem.id}/share-close`, {
    method: "POST",
    headers: withIdempotencyKey(ownerAuth),
    body: JSON.stringify({ version: removed.version })
  });
  assert(closed.hasActiveShareLink === false, "share-close should remove the active share entry");

  const closedPreview = await request<ShoppingSharePreview>(`/shopping-shares/${secondToken}`, {
    headers: collaboratorAuth
  });
  assert(closedPreview.status === 200 && closedPreview.body.code === 404, "share-close should invalidate the active token");

  console.log(
    JSON.stringify(
      {
        apiBaseUrl,
        listId: withItem.id,
        firstToken,
        secondToken,
        manualItemCount: withItem.items.length,
        activeBefore,
        activeAfter,
        memberCopyListId: memberCopy.id,
        removedCollaboratorUid: collaborator.user.uid,
        removedCollaboratorUserId: collaboratorMember.userId,
        finalMemberCount: closed.memberCount,
        finalHasActiveShareLink: closed.hasActiveShareLink
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
