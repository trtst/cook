import { createHash } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import type {
  AcceptInviteResponse,
  AdminDiningGroupSummary,
  CreateInviteResult,
  DiningGroupMembersResult,
  DiningGroupSummary,
  DissolveDiningGroupResponse,
  GetMyDiningGroupsResponse,
  LeaveDiningGroupResponse,
  MeResponse,
  PageResult,
  RemoveDiningGroupMemberResponse,
  StorageUsageSummary
} from "../src/contracts/types";
import { loadLocalEnv } from "../src/common/load-env";

loadLocalEnv();

const apiBaseUrl = process.env.API_BASE_URL ?? "http://127.0.0.1:3100/api";
const ownerPhone = process.env.TEST_OWNER_PHONE ?? "13800000000";
const freePhone = process.env.TEST_FREE_PHONE ?? "13900000000";
const memberPhone = process.env.TEST_MEMBER_PHONE ?? "13700000000";
const password = process.env.TEST_USER_PASSWORD ?? "change-me";
const adminUsername = process.env.ADMIN_SEED_USERNAME ?? "admin";
const adminPassword = process.env.ADMIN_SEED_PASSWORD ?? "change-me";

interface ApiEnvelope<T> {
  code: number;
  message: string;
  data: T;
}

interface LoginResult {
  token: string;
  user: { uid: number };
}

interface AdminLoginResult {
  token: string;
}

let idempotencySeed = Date.now();

const commonHeaders = {
  "content-type": "application/json",
  "x-cook-from": "mini_program",
  "x-cook-version": "0.1.0"
};

const adminHeaders = {
  "content-type": "application/json",
  "x-cook-from": "admin_web",
  "x-admin-version": "0.1.0",
  "x-admin-build": "1"
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function nextIdempotencyKey() {
  idempotencySeed += 1;
  return String(idempotencySeed);
}

function withIdempotencyKey(headers: Record<string, string>, key = nextIdempotencyKey()) {
  return {
    ...headers,
    "Idempotency-Key": key
  };
}

function tokenHash(inviteToken: string) {
  return createHash("sha256").update(inviteToken).digest("hex");
}

async function request<T>(path: string, options: RequestInit = {}) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers: { ...commonHeaders, ...options.headers }
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

async function requestAdmin<T>(path: string, token: string) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    headers: { ...adminHeaders, authorization: `Bearer ${token}` }
  });
  const body = (await response.json()) as ApiEnvelope<T>;
  assert(response.status >= 200 && response.status < 300, `${path} HTTP ${response.status}: ${body.message}`);
  assert(body.code === 0, `${path} code ${body.code}: ${body.message}`);
  return body.data;
}

function findOwnedGroup(items: DiningGroupSummary[]) {
  return items.find(item => item.isOwned) ?? null;
}

async function main() {
  const prisma = new PrismaClient();

  try {
    const ownerLogin = await requestData<LoginResult>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ phone: ownerPhone, password })
    });
    const freeLogin = await requestData<LoginResult>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ phone: freePhone, password })
    });
    const memberLogin = await requestData<LoginResult>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ phone: memberPhone, password })
    });
    const adminLogin = await requestData<AdminLoginResult>("/admin/auth/login", {
      method: "POST",
      headers: adminHeaders,
      body: JSON.stringify({ username: adminUsername, password: adminPassword })
    });

    const ownerAuthorization = `Bearer ${ownerLogin.token}`;
    const freeAuthorization = `Bearer ${freeLogin.token}`;
    const memberAuthorization = `Bearer ${memberLogin.token}`;
    const memberUser = await prisma.user.findUnique({
      where: { phone: memberPhone },
      select: { id: true }
    });
    assert(memberUser, "member user should exist in database");

    const [ownerGroupsBefore, freeGroupsBefore, memberGroupsBefore, ownerMe, memberMe, ownerStorage] =
      await Promise.all([
        requestData<GetMyDiningGroupsResponse>("/dining-groups", { headers: { authorization: ownerAuthorization } }),
        requestData<GetMyDiningGroupsResponse>("/dining-groups", { headers: { authorization: freeAuthorization } }),
        requestData<GetMyDiningGroupsResponse>("/dining-groups", { headers: { authorization: memberAuthorization } }),
        requestData<MeResponse>("/users/me", {
          headers: { authorization: ownerAuthorization }
        }),
        requestData<MeResponse>("/users/me", {
          headers: { authorization: memberAuthorization }
        }),
        requestData<StorageUsageSummary>("/storage-usage", { headers: { authorization: ownerAuthorization } })
      ]);

    let ownerGroup = findOwnedGroup(ownerGroupsBefore.items);
    const freeGroup = findOwnedGroup(freeGroupsBefore.items);
    const memberOwnGroup = findOwnedGroup(memberGroupsBefore.items);

    assert(ownerGroup, "owner should have an owned dining group");
    assert(freeGroup, "free user should have an owned dining group");
    assert(memberOwnGroup, "member user should have an owned dining group");
    assert(ownerMe.membership.tier === "PRO", "owner tier should be PRO");
    assert(memberMe.membership.tier === "PLUS", "member tier should be PLUS");
    assert(ownerGroupsBefore.usage.joinLimit >= ownerGroupsBefore.usage.joinedCount, "owner usage should include join limit");
    assert(ownerStorage.calculatedAt.length > 0, "storage usage should include calculation time");

    if (memberGroupsBefore.items.some(item => item.id === ownerGroup.id && item.myStatus === "ACTIVE")) {
      await requestData<RemoveDiningGroupMemberResponse>(`/dining-groups/${ownerGroup.id}/remove-member`, {
        method: "POST",
        headers: withIdempotencyKey({ authorization: ownerAuthorization }),
        body: JSON.stringify({
          userId: memberUser.id,
          expectedVersion: ownerGroup.version
        })
      });
      const ownerGroupsAfterCleanup = await requestData<GetMyDiningGroupsResponse>("/dining-groups", {
        headers: { authorization: ownerAuthorization }
      });
      ownerGroup = findOwnedGroup(ownerGroupsAfterCleanup.items);
      assert(ownerGroup, "owner group should remain active after cleanup");
    }

    const createOperationId = nextIdempotencyKey();
    const invite1 = await requestData<CreateInviteResult>("/dining-group-invites", {
      method: "POST",
      headers: withIdempotencyKey({ authorization: ownerAuthorization }, createOperationId),
      body: JSON.stringify({ diningGroupId: ownerGroup.id })
    });
    const invite2 = await requestData<CreateInviteResult>("/dining-group-invites", {
      method: "POST",
      headers: withIdempotencyKey({ authorization: ownerAuthorization }, createOperationId),
      body: JSON.stringify({ diningGroupId: ownerGroup.id })
    });
    assert(invite1.inviteToken === invite2.inviteToken, "create invite should be idempotent");

    const inviteRow = await prisma.diningGroupInvite.findUnique({
      where: { tokenHash: tokenHash(invite1.inviteToken) }
    });
    assert(inviteRow, "invite hash should be persisted");
    assert(inviteRow.tokenHash !== invite1.inviteToken, "invite token should not be stored in plaintext");

    const freeAccept = await request<AcceptInviteResponse>(
      `/dining-group-invites/${encodeURIComponent(invite1.inviteToken)}/accept`,
      {
        method: "POST",
        headers: withIdempotencyKey({ authorization: freeAuthorization })
      }
    );
    assert(freeAccept.status === 400, "free user with owned group should not be able to join another dining group");

    const acceptOperationId = nextIdempotencyKey();
    const accept1 = await requestData<AcceptInviteResponse>(
      `/dining-group-invites/${encodeURIComponent(invite1.inviteToken)}/accept`,
      {
        method: "POST",
        headers: withIdempotencyKey({ authorization: memberAuthorization }, acceptOperationId)
      }
    );
    const accept2 = await requestData<AcceptInviteResponse>(
      `/dining-group-invites/${encodeURIComponent(invite1.inviteToken)}/accept`,
      {
        method: "POST",
        headers: withIdempotencyKey({ authorization: memberAuthorization }, acceptOperationId)
      }
    );
    assert(accept1.diningGroup.id === ownerGroup.id, "member should join owner group");
    assert(accept2.diningGroup.id === ownerGroup.id, "accept invite should be idempotent");

    const membersAfterAccept = await requestData<DiningGroupMembersResult>(
      `/dining-group-members?diningGroupId=${ownerGroup.id}`,
      { headers: { authorization: ownerAuthorization } }
    );
    assert(membersAfterAccept.members.length === 2, "owner group should have owner and accepted member");

    const removeOperationId = nextIdempotencyKey();
    const remove1 = await requestData<RemoveDiningGroupMemberResponse>(
      `/dining-groups/${ownerGroup.id}/remove-member`,
      {
        method: "POST",
        headers: withIdempotencyKey({ authorization: ownerAuthorization }, removeOperationId),
        body: JSON.stringify({
          userId: memberUser.id,
          expectedVersion: accept1.diningGroup.version
        })
      }
    );
    const remove2 = await requestData<RemoveDiningGroupMemberResponse>(
      `/dining-groups/${ownerGroup.id}/remove-member`,
      {
        method: "POST",
        headers: withIdempotencyKey({ authorization: ownerAuthorization }, removeOperationId),
        body: JSON.stringify({
          userId: memberUser.id,
          expectedVersion: accept1.diningGroup.version
        })
      }
    );
    assert(remove1.userId === remove2.userId, "remove member should be idempotent");

    const memberGroupsAfterRemove = await requestData<GetMyDiningGroupsResponse>("/dining-groups", {
      headers: { authorization: memberAuthorization }
    });
    assert(memberGroupsAfterRemove.items.length === 1, "removed member should only keep owned dining group");

    const ownerGroupsAfterRemove = await requestData<GetMyDiningGroupsResponse>("/dining-groups", {
      headers: { authorization: ownerAuthorization }
    });
    const ownerGroupAfterRemove = findOwnedGroup(ownerGroupsAfterRemove.items);
    assert(ownerGroupAfterRemove, "owner group should remain active after removing a member");

    const leaveOwn = await request<LeaveDiningGroupResponse>(`/dining-groups/${ownerGroup.id}/leave`, {
      method: "POST",
      headers: withIdempotencyKey({ authorization: ownerAuthorization }),
      body: JSON.stringify({ expectedVersion: ownerGroupAfterRemove.version })
    });
    assert(leaveOwn.status === 400, "owner should not leave own dining group directly");

    const dissolveOperationId = nextIdempotencyKey();
    const dissolve1 = await requestData<DissolveDiningGroupResponse>(`/dining-groups/${ownerGroup.id}/dissolve`, {
      method: "POST",
      headers: withIdempotencyKey({ authorization: ownerAuthorization }, dissolveOperationId),
      body: JSON.stringify({ expectedVersion: ownerGroupAfterRemove.version })
    });
    const dissolve2 = await requestData<DissolveDiningGroupResponse>(`/dining-groups/${ownerGroup.id}/dissolve`, {
      method: "POST",
      headers: withIdempotencyKey({ authorization: ownerAuthorization }, dissolveOperationId),
      body: JSON.stringify({ expectedVersion: ownerGroupAfterRemove.version })
    });
    assert(dissolve1.diningGroupId === dissolve2.diningGroupId, "dissolve should be idempotent");

    const ownerGroupsAfterDissolve = await requestData<GetMyDiningGroupsResponse>("/dining-groups", {
      headers: { authorization: ownerAuthorization }
    });
    assert(ownerGroupsAfterDissolve.items.length === 0, "owner should have no active dining groups after dissolve");

    const adminDiningGroups = await requestAdmin<PageResult<AdminDiningGroupSummary>>(
      "/admin/dining-groups?page=1&pageSize=100",
      adminLogin.token
    );
    const archivedOwnerGroup = adminDiningGroups.items.find(item => item.id === ownerGroup.id);
    assert(archivedOwnerGroup?.status === "ARCHIVED", "admin should observe archived dissolved dining group");

    console.log(
      JSON.stringify(
        {
          apiBaseUrl,
          ownerGroupId: ownerGroup.id,
          ownerTier: ownerMe.membership.tier,
          memberTier: memberMe.membership.tier,
          freeAcceptStatus: freeAccept.status,
          acceptedMemberUid: accept1.diningGroup.ownerUid,
          ownerGroupsAfterDissolve: ownerGroupsAfterDissolve.items.length,
          archivedOwnerGroupStatus: archivedOwnerGroup?.status ?? null
        },
        null,
        2
      )
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
