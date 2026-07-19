import { createHash, randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { loadLocalEnv } from "../src/common/load-env";

loadLocalEnv();

const apiBaseUrl = process.env.API_BASE_URL ?? "http://127.0.0.1:3310/api";
const ownerPhone = process.env.TEST_OWNER_PHONE ?? "13800000000";
const guestPhone = process.env.TEST_GUEST_PHONE ?? "13900000000";
const password = process.env.TEST_USER_PASSWORD ?? "change-me";

interface ApiEnvelope<T> {
  code: number;
  message: string;
  data: T;
}

interface LoginResult {
  token: string;
  user: { id: string; uid: number };
}

interface MyDiningGroupsResult {
  diningGroups: Array<{ id: string }>;
}

interface CreateInviteResult {
  inviteToken: string;
  sharePath: string;
  expiresAt: string;
}

interface AcceptInviteResult {
  diningGroup: { id: string };
  member: { id: string; role: string; user: { id: string; uid: number } };
}

interface DiningGroupMembersResult {
  diningGroupId: string;
  members: Array<{ role: string; status: string; user: { id: string; uid: number } }>;
}

const commonHeaders = {
  "content-type": "application/json",
  "x-cook-from": "mini_program",
  "x-cook-version": "0.1.0"
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function tokenHash(inviteToken: string) {
  return createHash("sha256").update(inviteToken).digest("hex");
}

async function request<T>(path: string, options: RequestInit = {}) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers: {
      ...commonHeaders,
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

async function main() {
  const ownerLogin = await requestData<LoginResult>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ phone: ownerPhone, password })
  });
  const ownerAuthorization = `Bearer ${ownerLogin.token}`;

  const guestLogin = await requestData<LoginResult>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ phone: guestPhone, password })
  });
  const guestAuthorization = `Bearer ${guestLogin.token}`;

  const mine = await requestData<MyDiningGroupsResult>("/dining-groups/mine", {
    headers: { authorization: ownerAuthorization }
  });
  const diningGroupId = mine.diningGroups[0]?.id;
  assert(diningGroupId, "seed owner has no dining group");

  const prisma = new PrismaClient();
  try {
    await prisma.diningGroupMember.deleteMany({
      where: {
        diningGroupId,
        userId: guestLogin.user.id
      }
    });

    const createOperationId = randomUUID();
    const createInviteBody = JSON.stringify({
      diningGroupId,
      operationId: createOperationId
    });
    const invite1 = await requestData<CreateInviteResult>("/dining-group-invites", {
      method: "POST",
      headers: { authorization: ownerAuthorization },
      body: createInviteBody
    });
    const invite2 = await requestData<CreateInviteResult>("/dining-group-invites", {
      method: "POST",
      headers: { authorization: ownerAuthorization },
      body: createInviteBody
    });

    assert(invite1.inviteToken === invite2.inviteToken, "create invite is not idempotent");
    assert(invite1.sharePath === invite2.sharePath, "create invite sharePath is not idempotent");
    assert(invite1.expiresAt === invite2.expiresAt, "create invite expiresAt is not idempotent");
    assert(invite1.inviteToken.length >= 32, "invite token is too short");
    assert(!invite1.inviteToken.includes("."), "invite token looks like a structured token");

    const inviteRow = await prisma.diningGroupInvite.findUnique({
      where: { tokenHash: tokenHash(invite1.inviteToken) },
      select: { tokenHash: true, status: true }
    });
    assert(inviteRow, "invite token hash was not persisted");
    assert(inviteRow.tokenHash.length === 64, "invite token hash is not sha256 hex");
    assert(inviteRow.tokenHash !== invite1.inviteToken, "raw invite token was stored as hash");
    assert(inviteRow.status === "ACTIVE", "invite row is not active");

    const acceptOperationId = randomUUID();
    const acceptInviteBody = JSON.stringify({ operationId: acceptOperationId });
    const acceptPath = `/dining-group-invites/${encodeURIComponent(invite1.inviteToken)}/accept`;
    const accept1 = await requestData<AcceptInviteResult>(acceptPath, {
      method: "POST",
      headers: { authorization: guestAuthorization },
      body: acceptInviteBody
    });
    const accept2 = await requestData<AcceptInviteResult>(acceptPath, {
      method: "POST",
      headers: { authorization: guestAuthorization },
      body: acceptInviteBody
    });

    assert(accept1.diningGroup.id === accept2.diningGroup.id, "accept invite dining group is not idempotent");
    assert(accept1.member.id === accept2.member.id, "accept invite member is not idempotent");
    assert(accept1.member.user.id === guestLogin.user.id, "accepted member is not the guest user");
    assert(accept1.member.role === "MEMBER", "accepted member role is not MEMBER");

    const persistedGuestMember = await prisma.diningGroupMember.findUnique({
      where: {
        diningGroupId_userId: {
          diningGroupId,
          userId: guestLogin.user.id
        }
      },
      select: { role: true, status: true }
    });
    assert(persistedGuestMember?.role === "MEMBER", "guest member role was not persisted");
    assert(persistedGuestMember.status === "ACTIVE", "guest member status was not persisted as ACTIVE");

    const members = await requestData<DiningGroupMembersResult>(`/dining-group-members?diningGroupId=${diningGroupId}`, {
      headers: { authorization: ownerAuthorization }
    });
    const ownerMember = members.members.find(member => member.user.id === ownerLogin.user.id);
    const guestMember = members.members.find(member => member.user.id === guestLogin.user.id);
    assert(members.diningGroupId === diningGroupId, "members result diningGroupId mismatch");
    assert(ownerMember?.role === "OWNER", "owner was not returned as OWNER");
    assert(ownerMember.status === "ACTIVE", "owner member status is not ACTIVE");
    assert(guestMember?.role === "MEMBER", "guest was not returned as MEMBER");
    assert(guestMember.status === "ACTIVE", "guest member status is not ACTIVE");

    const invalid = await request("/dining-group-invites/not-a-real-token/accept", {
      method: "POST",
      headers: { authorization: guestAuthorization },
      body: JSON.stringify({ operationId: randomUUID() })
    });
    assert(invalid.status === 400, "invalid invite token should return 400");

    const unauthenticated = await request<MyDiningGroupsResult>("/dining-groups/mine");
    assert(unauthenticated.status === 401, "unauthenticated request should return 401");

    console.log(
      JSON.stringify(
        {
          apiBaseUrl,
          diningGroupId,
          ownerUid: ownerLogin.user.uid,
          guestUid: guestLogin.user.uid,
          createInviteIdempotent: true,
          acceptInviteIdempotent: true,
          guestJoinedAsMember: true,
          memberListContainsOwnerAndGuest: true,
          inviteTokenShape: {
            length: invite1.inviteToken.length,
            hasDot: invite1.inviteToken.includes(".")
          },
          tokenHashPersisted: true,
          invalidInviteStatus: invalid.status,
          unauthenticatedStatus: unauthenticated.status
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
