import { createHash, randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import type {
  AcceptInviteResponse,
  CreateInviteResult,
  DiningGroupMembersResult,
  GetCurrentDiningGroupContextResponse,
  LeaveDiningGroupResponse
} from "@next-meal/api-client";
import { loadLocalEnv } from "../src/common/load-env";

loadLocalEnv();

const apiBaseUrl = process.env.API_BASE_URL ?? "http://127.0.0.1:3100/api";
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

const commonHeaders = {
  "content-type": "application/json",
  "x-cook-from": "mini_program",
  "x-cook-version": "0.1.0"
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
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

  const ownerBefore = await requestData<GetCurrentDiningGroupContextResponse>("/dining-groups/current", {
    headers: { authorization: ownerAuthorization }
  });
  const guestBefore = await requestData<GetCurrentDiningGroupContextResponse>("/dining-groups/current", {
    headers: { authorization: guestAuthorization }
  });
  assert(ownerBefore.originalSpace === null, "owner should start in the original space");
  assert(guestBefore.originalSpace === null, "guest should start in the original space");
  assert(ownerBefore.currentSpace.id !== guestBefore.currentSpace.id, "seed users should own different solo spaces");

  const diningGroupId = ownerBefore.currentSpace.id;
  const prisma = new PrismaClient();

  try {
    const createOperationId = randomUUID();
    const createInviteBody = JSON.stringify({ diningGroupId, operationId: createOperationId });
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
      where: { tokenHash: tokenHash(invite1.inviteToken) }
    });
    assert(inviteRow, "invite token hash was not persisted");
    assert(inviteRow.status === "PENDING", "new invite is not pending");
    assert(inviteRow.tokenHash !== invite1.inviteToken, "raw invite token was persisted");

    const acceptOperationId = randomUUID();
    const acceptPath = `/dining-group-invites/${encodeURIComponent(invite1.inviteToken)}/accept`;
    const acceptBody = JSON.stringify({ operationId: acceptOperationId });
    const accept1 = await requestData<AcceptInviteResponse>(acceptPath, {
      method: "POST",
      headers: { authorization: guestAuthorization },
      body: acceptBody
    });
    const accept2 = await requestData<AcceptInviteResponse>(acceptPath, {
      method: "POST",
      headers: { authorization: guestAuthorization },
      body: acceptBody
    });

    assert(accept1.currentSpace.id === diningGroupId, "guest did not switch to the invited dining group");
    assert(accept2.currentSpace.id === accept1.currentSpace.id, "accept invite is not idempotent");
    assert(accept1.originalSpace.id === guestBefore.currentSpace.id, "guest original space mismatch");
    assert(accept1.originalSpace.status === "FROZEN", "guest original space was not frozen");

    const persistedInvite = await prisma.diningGroupInvite.findUnique({ where: { id: inviteRow.id } });
    assert(persistedInvite?.status === "ACCEPTED", "invite was not consumed");
    assert(persistedInvite.acceptedByUserId === guestLogin.user.id, "invite acceptor mismatch");

    const guestSpaceAfterAccept = await prisma.userSpace.findUnique({
      where: { userId: guestLogin.user.id },
      include: { originalDiningGroup: true }
    });
    assert(guestSpaceAfterAccept?.currentDiningGroupId === diningGroupId, "guest current space was not persisted");
    assert(guestSpaceAfterAccept.originalDiningGroup.status === "FROZEN", "original space freeze was not persisted");

    const members = await requestData<DiningGroupMembersResult>(`/dining-group-members?diningGroupId=${diningGroupId}`, {
      headers: { authorization: ownerAuthorization }
    });
    const ownerMember = members.members.find(member => member.user.id === ownerLogin.user.id);
    const guestMember = members.members.find(member => member.user.id === guestLogin.user.id);
    assert(ownerMember?.role === "OWNER" && ownerMember.status === "ACTIVE", "owner member mismatch");
    assert(guestMember?.role === "MEMBER" && guestMember.status === "ACTIVE", "guest member mismatch");

    const reusedInvite = await request(acceptPath, {
      method: "POST",
      headers: { authorization: ownerAuthorization },
      body: JSON.stringify({ operationId: randomUUID() })
    });
    assert(reusedInvite.status === 400, "consumed invite should not be reusable");

    const leaveOperationId = randomUUID();
    const leaveBody = JSON.stringify({ operationId: leaveOperationId });
    const leave1 = await requestData<LeaveDiningGroupResponse>(`/dining-groups/${diningGroupId}/leave`, {
      method: "POST",
      headers: { authorization: guestAuthorization },
      body: leaveBody
    });
    const leave2 = await requestData<LeaveDiningGroupResponse>(`/dining-groups/${diningGroupId}/leave`, {
      method: "POST",
      headers: { authorization: guestAuthorization },
      body: leaveBody
    });

    assert(leave1.restoredSpace.id === guestBefore.currentSpace.id, "leave did not restore the original space");
    assert(leave2.carryBackSnapshot?.id === leave1.carryBackSnapshot?.id, "leave is not idempotent");
    assert(leave1.carryBackSnapshot?.status === "AVAILABLE", "carry-back snapshot is not available");

    const guestMemberAfterLeave = await prisma.diningGroupMember.findUnique({
      where: { diningGroupId_userId: { diningGroupId, userId: guestLogin.user.id } }
    });
    assert(guestMemberAfterLeave?.status === "ENDED", "guest membership was not ended");
    assert(guestMemberAfterLeave.statusReason === "LEFT", "guest membership end reason mismatch");

    const guestAfterLeave = await requestData<GetCurrentDiningGroupContextResponse>("/dining-groups/current", {
      headers: { authorization: guestAuthorization }
    });
    assert(guestAfterLeave.currentSpace.id === guestBefore.currentSpace.id, "current endpoint did not restore solo space");
    assert(guestAfterLeave.originalSpace === null, "restored user should not expose a frozen original space");

    const invalid = await request("/dining-group-invites/not-a-real-token/accept", {
      method: "POST",
      headers: { authorization: guestAuthorization },
      body: JSON.stringify({ operationId: randomUUID() })
    });
    assert(invalid.status === 400, "invalid invite token should return 400");

    const unauthenticated = await request<GetCurrentDiningGroupContextResponse>("/dining-groups/current");
    assert(unauthenticated.status === 401, "unauthenticated current space should return 401");

    console.log(
      JSON.stringify(
        {
          apiBaseUrl,
          diningGroupId,
          ownerUid: ownerLogin.user.uid,
          guestUid: guestLogin.user.uid,
          createInviteIdempotent: true,
          acceptInviteIdempotent: true,
          inviteConsumedOnce: true,
          originalSpaceFrozen: true,
          leaveIdempotent: true,
          originalSpaceRestored: true,
          carryBackSnapshotCreated: true,
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
