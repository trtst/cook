import { PrismaClient, type EntitlementTier } from "@prisma/client";
import { loadLocalEnv } from "../src/common/load-env";
import { hashPassword } from "../src/common/security/password";
import type {
  DiningGroupMembersResult,
  GetMyDiningGroupsResponse,
  PasswordLoginResult,
  ShoppingListDetail,
  ShoppingListInviteActionResponse,
  ShoppingListInvitePageResponse,
  ShoppingListPageResponse,
  ShoppingListStatus,
  ShoppingListSummaryResponse,
  ShoppingSharePreview
} from "../src/contracts/types";

loadLocalEnv();

const apiBaseUrl = process.env.API_BASE_URL ?? "http://127.0.0.1:3100/api";
const ownerPhone = process.env.TEST_OWNER_PHONE ?? "13800000000";
const memberPhone = process.env.TEST_MEMBER_PHONE ?? "13700000000";
const freePhone = process.env.TEST_FREE_PHONE ?? "13900000000";
const password = process.env.TEST_USER_PASSWORD ?? "change-me";
const verifyPrefix = "vshop-";
const memberUid = 91827364;
const prisma = new PrismaClient();

interface ApiEnvelope<T> {
  code: number;
  message: string;
  data: T;
}

let idSeed = Date.now();

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function nextId() {
  idSeed += 1;
  return String(idSeed);
}

function withId(headers: Record<string, string>, key = nextId()) {
  return {
    ...headers,
    "Idempotency-Key": key
  };
}

function auth(token: string) {
  return { authorization: `Bearer ${token}` };
}

function verifyName(label: string) {
  const shortLabel = label.replace(/[^a-z0-9-]/gi, "").slice(0, 8) || "case";
  return `${verifyPrefix}${shortLabel}-${nextId().slice(-4)}`;
}

async function ensureTestUser(input: {
  id: number;
  uid: number;
  nickname: string;
  phone: string;
  tier: EntitlementTier | null;
  groupName: string;
}) {
  const user = await prisma.user.upsert({
    where: { id: input.id },
    update: {
      uid: input.uid,
      nickname: input.nickname,
      phone: input.phone,
      passwordHash: hashPassword(password),
      status: "ACTIVE"
    },
    create: {
      id: input.id,
      uid: input.uid,
      nickname: input.nickname,
      phone: input.phone,
      passwordHash: hashPassword(password),
      status: "ACTIVE"
    }
  });

  const group = await prisma.diningGroup.upsert({
    where: { ownerId: user.id },
    update: {
      name: input.groupName,
      status: "ACTIVE",
      archivedAt: null
    },
    create: {
      name: input.groupName,
      ownerId: user.id,
      status: "ACTIVE"
    }
  });

  await prisma.diningGroupMember.upsert({
    where: {
      diningGroupId_userId: {
        diningGroupId: group.id,
        userId: user.id
      }
    },
    update: {
      role: "OWNER",
      status: "ACTIVE",
      statusReason: null,
      restrictedAt: null,
      endedAt: null
    },
    create: {
      diningGroupId: group.id,
      userId: user.id,
      role: "OWNER",
      status: "ACTIVE"
    }
  });

  await prisma.diningGroupMember.updateMany({
    where: {
      diningGroupId: group.id,
      userId: { not: user.id },
      status: { in: ["ACTIVE", "RESTRICTED"] }
    },
    data: {
      status: "ENDED",
      statusReason: "GROUP_DISSOLVED",
      endedAt: new Date()
    }
  });

  await prisma.diningGroupInvite.deleteMany({
    where: { diningGroupId: group.id }
  });

  if (input.tier) {
    await prisma.entitlementGrant.upsert({
      where: { userId: user.id },
      update: {
        tier: input.tier,
        startsAt: new Date(),
        endsAt: null
      },
      create: {
        userId: user.id,
        tier: input.tier,
        startsAt: new Date(),
        endsAt: null
      }
    });
  } else {
    await prisma.entitlementGrant.deleteMany({
      where: { userId: user.id }
    });
  }

  await prisma.diningGroupMember.updateMany({
    where: {
      userId: user.id,
      diningGroupId: { not: group.id },
      status: { in: ["ACTIVE", "RESTRICTED"] }
    },
    data: {
      status: "ENDED",
      statusReason: "LEFT",
      restrictedAt: null,
      endedAt: new Date()
    }
  });

  return user;
}

async function ensureVerifyUsers() {
  await ensureTestUser({
    id: 1001,
    uid: 52738164,
    nickname: "下一餐主理人",
    phone: ownerPhone,
    tier: "PRO",
    groupName: "主理人的饭搭子"
  });
  await ensureTestUser({
    id: 1002,
    uid: 83947215,
    nickname: "下一餐成员",
    phone: freePhone,
    tier: null,
    groupName: "成员的饭搭子"
  });
  await ensureTestUser({
    id: 1003,
    uid: memberUid,
    nickname: "下一餐协作成员",
    phone: memberPhone,
    tier: "PLUS",
    groupName: "协作成员的饭搭子"
  });
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

async function expectMissing(path: string, options: RequestInit = {}, message = "request should fail with 404") {
  const result = await request(path, options);
  assert(result.status === 404, `${message}: HTTP ${result.status}`);
}

async function login(phone: string) {
  return requestData<PasswordLoginResult>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ phone, password })
  });
}

async function ensureMemberJoinedOwnerGroup(ownerHeaders: Record<string, string>, memberHeaders: Record<string, string>, ownerGroupId: number) {
  const memberGroups = await requestData<GetMyDiningGroupsResponse>("/dining-groups", { headers: memberHeaders });
  if (memberGroups.items.some(item => item.id === ownerGroupId && item.myStatus === "ACTIVE")) {
    return;
  }

  const invite = await requestData<{ inviteToken: string }>("/dining-group-invites", {
    method: "POST",
    headers: withId(ownerHeaders),
    body: JSON.stringify({ diningGroupId: ownerGroupId })
  });

  await requestData(`/dining-group-invites/${encodeURIComponent(invite.inviteToken)}/accept`, {
    method: "POST",
    headers: withId(memberHeaders)
  });
}

async function getOwnedGroup(headers: Record<string, string>) {
  const groups = await requestData<GetMyDiningGroupsResponse>("/dining-groups", { headers });
  const owned = groups.items.find(item => item.isOwned);
  assert(owned, "owned dining group should exist");
  return owned;
}

async function listStatus(headers: Record<string, string>, status: ShoppingListStatus) {
  return requestData<ShoppingListPageResponse>(`/shopping-lists?status=${status}`, { headers });
}

async function createList(headers: Record<string, string>, name: string) {
  return requestData<ShoppingListDetail>("/shopping-lists", {
    method: "POST",
    headers: withId(headers),
    body: JSON.stringify({ name })
  });
}

async function createItem(headers: Record<string, string>, detail: ShoppingListDetail, name: string, quantityText: string) {
  return requestData<ShoppingListDetail>(`/shopping-lists/${detail.id}/items`, {
    method: "POST",
    headers: withId(headers),
    body: JSON.stringify({
      name,
      ingredientId: null,
      quantityText,
      note: "verify item"
    })
  });
}

async function listInvites(headers: Record<string, string>) {
  return requestData<ShoppingListInvitePageResponse>("/shopping-list-invites", { headers });
}

async function acceptInvite(headers: Record<string, string>, inviteId: number) {
  return requestData<ShoppingListDetail>(`/shopping-list-invites/${inviteId}/accept`, {
    method: "POST",
    headers: withId(headers)
  });
}

async function declineInvite(headers: Record<string, string>, inviteId: number) {
  return requestData<ShoppingListInviteActionResponse>(`/shopping-list-invites/${inviteId}/decline`, {
    method: "POST",
    headers: withId(headers)
  });
}

async function voidList(headers: Record<string, string>, detail: ShoppingListDetail) {
  return requestData<ShoppingListDetail>(`/shopping-lists/${detail.id}/void`, {
    method: "POST",
    headers: withId(headers),
    body: JSON.stringify({ version: detail.version })
  });
}

async function deleteList(headers: Record<string, string>, detail: ShoppingListDetail) {
  return requestData<ShoppingListPageResponse>(`/shopping-lists/${detail.id}/delete`, {
    method: "POST",
    headers: withId(headers),
    body: JSON.stringify({ version: detail.version })
  });
}

async function cleanupVerifyLists(headers: Record<string, string>) {
  const targets: ShoppingListDetail[] = [];
  const [active, completed, voided] = await Promise.all([
    listStatus(headers, "ACTIVE"),
    listStatus(headers, "COMPLETED"),
    listStatus(headers, "VOIDED")
  ]);

  for (const item of [...active.items, ...completed.items, ...voided.items]) {
    if (!item.name.startsWith(verifyPrefix)) continue;
    const detail = await requestData<ShoppingListDetail>(`/shopping-lists/${item.id}`, { headers });
    targets.push(detail);
  }

  for (const detail of targets) {
    if (detail.status === "ACTIVE") {
      const voidedDetail = await voidList(headers, detail);
      await deleteList(headers, voidedDetail);
      continue;
    }
    await deleteList(headers, detail);
  }
}

async function main() {
  await ensureVerifyUsers();

  try {
    const owner = await login(ownerPhone);
    const member = await login(memberPhone);
    const freeUser = await login(freePhone);
    const ownerHeaders = auth(owner.token);
    const memberHeaders = auth(member.token);
    const freeHeaders = auth(freeUser.token);

    await cleanupVerifyLists(ownerHeaders);

    const ownerGroup = await getOwnedGroup(ownerHeaders);
    await ensureMemberJoinedOwnerGroup(ownerHeaders, memberHeaders, ownerGroup.id);

    const members = await requestData<DiningGroupMembersResult>(`/dining-group-members?diningGroupId=${ownerGroup.id}`, {
      headers: ownerHeaders
    });
    const memberRow = members.members.find(item => item.user.uid === memberUid);
    assert(memberRow, "owner dining group should include the seeded collaborator");
    assert(memberRow.userId > 0, "member summary should expose userId for share-members");

    const summary = await requestData<ShoppingListSummaryResponse>("/shopping-lists/summary", { headers: ownerHeaders });
    assert(summary.statuses.length === 3, "shopping list summary should expose 3 status cards");

    const inviteAcceptName = verifyName("invite-accept");
    let inviteAcceptList = await createList(ownerHeaders, inviteAcceptName);
    inviteAcceptList = await createItem(ownerHeaders, inviteAcceptList, `${inviteAcceptName}-cabbage`, "2 bags");
    inviteAcceptList = await requestData<ShoppingListDetail>(`/shopping-lists/${inviteAcceptList.id}/share-members`, {
      method: "POST",
      headers: withId(ownerHeaders),
      body: JSON.stringify({
        version: inviteAcceptList.version,
        targetUserIds: [memberRow.userId]
      })
    });
    assert(inviteAcceptList.memberCount === 1, "share-members should not occupy member count before invite acceptance");

    let memberInvites = await listInvites(memberHeaders);
    const acceptInviteRow = memberInvites.items.find(item => item.listId === inviteAcceptList.id);
    assert(acceptInviteRow, "shared buddy invite should appear in shopping-list-invites");
    assert(acceptInviteRow.canJoin, "pending invite should remain joinable when capacity is available");

    const accepted = await acceptInvite(memberHeaders, acceptInviteRow.id);
    assert(accepted.id === inviteAcceptList.id, "accept invite should open the invited list");
    assert(accepted.role === "COLLABORATOR", "accepted invite should create collaborator role");

    memberInvites = await listInvites(memberHeaders);
    assert(!memberInvites.items.some(item => item.listId === inviteAcceptList.id), "accepted invite should disappear from pending invites");
    inviteAcceptList = await requestData<ShoppingListDetail>(`/shopping-lists/${inviteAcceptList.id}`, { headers: ownerHeaders });
    assert(inviteAcceptList.memberCount >= 2, "accepted invite should increase member count");

    const memberShared = await requestData<ShoppingListDetail>(`/shopping-lists/${inviteAcceptList.id}`, { headers: memberHeaders });
    assert(memberShared.role === "COLLABORATOR", "accepted member should read list as collaborator");
    const memberActive = await listStatus(memberHeaders, "ACTIVE");
    assert(memberActive.items.some(item => item.id === inviteAcceptList.id), "accepted member should see shared list in ACTIVE tab");
    await deleteList(ownerHeaders, await voidList(ownerHeaders, inviteAcceptList));

    const inviteDeclineName = verifyName("invite-decline");
    let inviteDeclineList = await createList(ownerHeaders, inviteDeclineName);
    inviteDeclineList = await createItem(ownerHeaders, inviteDeclineList, `${inviteDeclineName}-pepper`, "1 bag");
    inviteDeclineList = await requestData<ShoppingListDetail>(`/shopping-lists/${inviteDeclineList.id}/share-members`, {
      method: "POST",
      headers: withId(ownerHeaders),
      body: JSON.stringify({
        version: inviteDeclineList.version,
        targetUserIds: [memberRow.userId]
      })
    });

    memberInvites = await listInvites(memberHeaders);
    const declineInviteRow = memberInvites.items.find(item => item.listId === inviteDeclineList.id);
    assert(declineInviteRow, "decline test invite should appear in shopping-list-invites");
    const declined = await declineInvite(memberHeaders, declineInviteRow.id);
    assert(declined.status === "DECLINED", "decline invite should mark invite as DECLINED");
    memberInvites = await listInvites(memberHeaders);
    assert(!memberInvites.items.some(item => item.listId === inviteDeclineList.id), "declined invite should disappear from pending invites");
    inviteDeclineList = await requestData<ShoppingListDetail>(`/shopping-lists/${inviteDeclineList.id}`, { headers: ownerHeaders });
    assert(inviteDeclineList.memberCount === 1, "declined invite should not increase member count");
    await deleteList(ownerHeaders, await voidList(ownerHeaders, inviteDeclineList));

    const linkName = verifyName("link");
    let linkList = await createList(ownerHeaders, linkName);
    linkList = await createItem(ownerHeaders, linkList, `${linkName}-tomato`, "3 pieces");
    linkList = await requestData<ShoppingListDetail>(`/shopping-lists/${linkList.id}/share-members`, {
      method: "POST",
      headers: withId(ownerHeaders),
      body: JSON.stringify({
        version: linkList.version,
        targetUserIds: [memberRow.userId]
      })
    });

    memberInvites = await listInvites(memberHeaders);
    const linkInviteRow = memberInvites.items.find(item => item.listId === linkList.id);
    assert(linkInviteRow, "link preemption test should still create a pending buddy invite");

    const link = await requestData<{ shareToken: string; shareUrl: string }>(`/shopping-lists/${linkList.id}/share-link`, {
      method: "POST",
      headers: withId(ownerHeaders),
      body: JSON.stringify({ version: linkList.version })
    });
    assert(link.shareToken.length > 0, "share-link should return share token");
    assert(link.shareUrl.includes(link.shareToken), "share-link should embed token in shareUrl");

    const preview = await requestData<ShoppingSharePreview>(`/shopping-shares/${encodeURIComponent(link.shareToken)}`, {
      headers: freeHeaders
    });
    assert(preview.listId === linkList.id, "share preview should point to the source list");
    assert(preview.itemCount >= 1, "share preview should expose current item count");

    const joined = await requestData<ShoppingListDetail>(`/shopping-shares/${encodeURIComponent(link.shareToken)}/join`, {
      method: "POST",
      headers: withId(freeHeaders)
    });
    assert(joined.role === "COLLABORATOR", "share-link join should create collaborator role");
    const freeActive = await listStatus(freeHeaders, "ACTIVE");
    assert(freeActive.items.some(item => item.id === linkList.id), "joined user should see shared list in ACTIVE tab");

    const memberPreview = await requestData<ShoppingSharePreview>(`/shopping-shares/${encodeURIComponent(link.shareToken)}`, {
      headers: memberHeaders
    });
    assert(memberPreview.canJoin, "invited buddy should still be able to join through share link before capacity is full");
    const memberJoinedByLink = await requestData<ShoppingListDetail>(`/shopping-shares/${encodeURIComponent(link.shareToken)}/join`, {
      method: "POST",
      headers: withId(memberHeaders)
    });
    assert(memberJoinedByLink.role === "COLLABORATOR", "buddy share-link join should still result in collaborator role");
    memberInvites = await listInvites(memberHeaders);
    assert(!memberInvites.items.some(item => item.listId === linkList.id), "joining by share link should auto-complete the matching pending invite");

    linkList = await requestData<ShoppingListDetail>(`/shopping-lists/${linkList.id}`, { headers: ownerHeaders });
    assert(linkList.memberCount >= 3, "link join plus buddy join should both be counted on owner detail");
    linkList = await requestData<ShoppingListDetail>(`/shopping-lists/${linkList.id}/share-link/disable`, {
      method: "POST",
      headers: withId(ownerHeaders),
      body: JSON.stringify({ version: linkList.version })
    });
    await expectMissing(`/shopping-shares/${encodeURIComponent(link.shareToken)}`, { headers: freeHeaders }, "disabled share preview should be missing");
    await expectMissing(
      `/shopping-shares/${encodeURIComponent(link.shareToken)}/join`,
      {
        method: "POST",
        headers: withId(freeHeaders)
      },
      "disabled share join should be missing"
    );
    await deleteList(ownerHeaders, await voidList(ownerHeaders, linkList));

    const completeName = verifyName("done");
    let completeList = await createList(ownerHeaders, completeName);
    completeList = await createItem(ownerHeaders, completeList, `${completeName}-milk`, "1 bottle");
    const completeItem = completeList.items.find(item => item.name === `${completeName}-milk`);
    assert(completeItem, "created shopping item should be returned in list detail");
    completeList = await requestData<ShoppingListDetail>(`/shopping-lists/${completeList.id}/items/${completeItem.id}/check`, {
      method: "POST",
      headers: withId(ownerHeaders),
      body: JSON.stringify({
        version: completeList.version,
        checked: true
      })
    });
    const checkedItem = completeList.items.find(item => item.id === completeItem.id);
    assert(checkedItem?.status === "CHECKED", "checked item should switch to CHECKED");

    completeList = await requestData<ShoppingListDetail>(`/shopping-lists/${completeList.id}/complete`, {
      method: "POST",
      headers: withId(ownerHeaders),
      body: JSON.stringify({
        version: completeList.version,
        entries: [
          {
            itemId: completeItem.id,
            store: false,
            quantityText: "1 bottle",
            expireDays: null,
            expireAt: null
          }
        ]
      })
    });
    assert(completeList.status === "COMPLETED", "complete should switch list status to COMPLETED");
    const completedPage = await listStatus(ownerHeaders, "COMPLETED");
    assert(completedPage.items.some(item => item.id === completeList.id), "completed list should enter COMPLETED tab");
    const completedDelete = await deleteList(ownerHeaders, completeList);
    assert(!completedDelete.items.some(item => item.id === completeList.id), "delete should remove completed list from COMPLETED tab");

    const voidName = verifyName("void");
    let voidListDetail = await createList(ownerHeaders, voidName);
    voidListDetail = await createItem(ownerHeaders, voidListDetail, `${voidName}-bread`, "2 packs");
    voidListDetail = await voidList(ownerHeaders, voidListDetail);
    assert(voidListDetail.status === "VOIDED", "void should switch list status to VOIDED");
    const voidedPage = await listStatus(ownerHeaders, "VOIDED");
    assert(voidedPage.items.some(item => item.id === voidListDetail.id), "voided list should enter VOIDED tab");
    const voidDelete = await deleteList(ownerHeaders, voidListDetail);
    assert(!voidDelete.items.some(item => item.id === voidListDetail.id), "delete should remove voided list from VOIDED tab");

    await cleanupVerifyLists(ownerHeaders);
    console.log("verify-shopping-list-shared-flow: ok");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
