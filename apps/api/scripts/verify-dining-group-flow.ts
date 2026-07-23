import { createHash, randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import type {
  AcceptInviteResponse,
  AdminDiningGroupSummary,
  AdminUserEntitlementResponse,
  CreateInviteResult,
  DiningGroupMembersResult,
  EffectiveEntitlementSnapshot,
  GetCarryBackSnapshotsResponse,
  GetCurrentDiningGroupContextResponse,
  LeaveDiningGroupResponse,
  PageResult,
  StorageUsageSummary
} from "../src/contracts/types";
import { loadLocalEnv } from "../src/common/load-env";

loadLocalEnv();

const apiBaseUrl = process.env.API_BASE_URL ?? "http://127.0.0.1:3100/api";
const ownerPhone = process.env.TEST_OWNER_PHONE ?? "13800000000";
const guestPhone = process.env.TEST_GUEST_PHONE ?? "13900000000";
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
  admin: { id: string; username: string };
}

function assertCurrentShape(result: GetCurrentDiningGroupContextResponse, expectedOriginalSpace: "null" | "frozen") {
  assert(typeof result.currentSpace.id === "string" && result.currentSpace.id.length > 0, "currentSpace.id missing");
  assert(typeof result.currentSpace.name === "string", "currentSpace.name missing");
  assert(typeof result.currentSpace.memberCount === "number", "currentSpace.memberCount missing");
  assert(typeof result.currentSpace.memberLimit === "number", "currentSpace.memberLimit missing");
  assert(typeof result.currentSpace.recipeCount === "number", "currentSpace.recipeCount missing");
  assert(typeof result.currentSpace.isShared === "boolean", "currentSpace.isShared missing");
  assert(
    result.currentSpace.sharedSince === null || typeof result.currentSpace.sharedSince === "string",
    "currentSpace.sharedSince invalid"
  );
  assert(
    result.currentSpace.sharedDays === null || typeof result.currentSpace.sharedDays === "number",
    "currentSpace.sharedDays invalid"
  );
  assert(result.entitlements !== null && typeof result.entitlements === "object", "entitlements missing");

  if (expectedOriginalSpace === "null") {
    assert(result.originalSpace === null, "originalSpace should be null");
    return;
  }

  assert(result.originalSpace !== null, "originalSpace should exist");
  assert(result.originalSpace.status === "FROZEN", "originalSpace should stay frozen");
  assert(typeof result.originalSpace.canImport === "boolean", "originalSpace.canImport missing");
}

const commonHeaders = {
  "content-type": "application/json",
  "x-cook-from": "mini_program",
  "x-cook-version": "0.1.0"
};

const adminHeaders = {
  "x-cook-from": "admin_web",
  "x-admin-version": "0.1.0",
  "x-admin-build": "1"
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function assertDbRejected(message: string, run: () => Promise<unknown>) {
  try {
    await run();
  } catch {
    return;
  }

  throw new Error(message);
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
  const adminLogin = await requestData<AdminLoginResult>("/admin/auth/login", {
    method: "POST",
    headers: adminHeaders,
    body: JSON.stringify({ username: adminUsername, password: adminPassword })
  });
  const adminAuthorization = `Bearer ${adminLogin.token}`;

  const ownerBefore = await requestData<GetCurrentDiningGroupContextResponse>("/dining-groups/current", {
    headers: { authorization: ownerAuthorization }
  });
  const guestBefore = await requestData<GetCurrentDiningGroupContextResponse>("/dining-groups/current", {
    headers: { authorization: guestAuthorization }
  });
  assertCurrentShape(ownerBefore, "null");
  assertCurrentShape(guestBefore, "null");
  assert(ownerBefore.originalSpace === null, "owner should start in the original space");
  assert(guestBefore.originalSpace === null, "guest should start in the original space");
  assert(ownerBefore.currentSpace.id !== guestBefore.currentSpace.id, "seed users should own different solo spaces");
  assert(ownerBefore.currentSpace.isShared === false, "owner solo space should not be shared before invite accept");
  assert(ownerBefore.currentSpace.sharedSince === null, "owner solo space sharedSince should be null");
  assert(ownerBefore.currentSpace.sharedDays === null, "owner solo space sharedDays should be null");
  assert(ownerBefore.currentSpace.recipeCount === 0, "recipeCount should stay 0 before recipe module is implemented");

  const ownerEntitlements = await requestData<EffectiveEntitlementSnapshot>("/entitlements/current", {
    headers: { authorization: ownerAuthorization }
  });
  const ownerStorage = await requestData<StorageUsageSummary>("/storage-usage", {
    headers: { authorization: ownerAuthorization }
  });
  assert(
    JSON.stringify(ownerEntitlements) === JSON.stringify(ownerBefore.entitlements),
    "standalone entitlement endpoint differs from current dining group context"
  );
  assert(ownerStorage.limitBytes === ownerEntitlements.storageLimitBytes, "storage limit differs from entitlement resolution");
  assert(ownerStorage.usedBytes === 0, "storage usage should stay at 0 before ledger is connected");
  assert(ownerStorage.remainingBytes === ownerStorage.limitBytes, "storage remaining bytes mismatch");
  assert(
    ownerBefore.currentSpace.memberLimit === (ownerEntitlements.diningGroupTier === "PLUS" ? 6 : 2),
    "current space member limit differs from the resolved dining group tier"
  );

  const diningGroupId = ownerBefore.currentSpace.id;
  const prisma = new PrismaClient();
  const [ownerUser, guestUser] = await Promise.all([
    prisma.user.findFirstOrThrow({ where: { phone: ownerPhone }, select: { id: true, uid: true } }),
    prisma.user.findFirstOrThrow({ where: { phone: guestPhone }, select: { id: true, uid: true } })
  ]);

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

    const invite3 = await requestData<CreateInviteResult>("/dining-group-invites", {
      method: "POST",
      headers: { authorization: ownerAuthorization },
      body: JSON.stringify({ diningGroupId, operationId: randomUUID() })
    });

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
    assert(accept1.currentSpace.isShared === true, "accepted dining group should be shared");
    assert(typeof accept1.currentSpace.sharedSince === "string", "accepted dining group sharedSince missing");
    assert(
      accept1.currentSpace.sharedDays !== null && accept1.currentSpace.sharedDays >= 1,
      "accepted dining group sharedDays invalid"
    );
    assertCurrentShape(
      {
        currentSpace: accept1.currentSpace,
        originalSpace: accept1.originalSpace,
        entitlements: ownerBefore.entitlements
      },
      "frozen"
    );
    assert(accept1.originalSpace.status === "FROZEN", "guest original space was not frozen");
    assert(typeof accept1.pendingImportCounts.recipe === "number", "accept pendingImportCounts.recipe missing");
    assert(typeof accept1.pendingImportCounts.fridgeItem === "number", "accept pendingImportCounts.fridgeItem missing");
    assert(typeof accept1.pendingImportCounts.planDraft === "number", "accept pendingImportCounts.planDraft missing");
    assert(typeof accept1.pendingImportCounts.shoppingItem === "number", "accept pendingImportCounts.shoppingItem missing");

    const conflictingAcceptInvite = await request(
      `/dining-group-invites/${encodeURIComponent(invite3.inviteToken)}/accept`,
      {
      method: "POST",
      headers: { authorization: guestAuthorization },
      body: JSON.stringify({ operationId: acceptOperationId })
      }
    );
    assert(conflictingAcceptInvite.status === 409, "conflicting accept invite operationId should return 409");

    const persistedInvite = await prisma.diningGroupInvite.findUnique({ where: { id: inviteRow.id } });
    assert(persistedInvite?.status === "ACCEPTED", "invite was not consumed");
    assert(persistedInvite.acceptedByUserId === guestUser.id, "invite acceptor mismatch");
    await assertDbRejected("accepted invite should not allow revokedAt with accepted fields", () =>
      prisma.diningGroupInvite.update({
        where: { id: inviteRow.id },
        data: {
          status: "REVOKED",
          revokedAt: new Date()
        }
      })
    );

    const adminDiningGroupsAfterAccept = await requestData<PageResult<AdminDiningGroupSummary>>("/admin/dining-groups?page=1&pageSize=100", {
      headers: { authorization: adminAuthorization, ...adminHeaders }
    });
    const acceptedGroup = adminDiningGroupsAfterAccept.items.find(item => item.id === diningGroupId);
    assert(acceptedGroup?.memberCount === 2, "admin dining group memberCount should count active members after accept");

    const guestSpaceAfterAccept = await prisma.userSpace.findUnique({
      where: { userId: guestUser.id },
      include: { originalDiningGroup: true }
    });
    assert(guestSpaceAfterAccept?.currentDiningGroupId === diningGroupId, "guest current space was not persisted");
    assert(guestSpaceAfterAccept.originalDiningGroup.status === "FROZEN", "original space freeze was not persisted");

    const members = await requestData<DiningGroupMembersResult>(`/dining-group-members?diningGroupId=${diningGroupId}`, {
      headers: { authorization: ownerAuthorization }
    });
    const ownerMember = members.members.find(member => member.user.uid === ownerUser.uid);
    const guestMember = members.members.find(member => member.user.uid === guestUser.uid);
    assert(ownerMember?.role === "OWNER" && ownerMember.status === "ACTIVE", "owner member mismatch");
    assert(guestMember?.role === "MEMBER" && guestMember.status === "ACTIVE", "guest member mismatch");

    await prisma.diningGroupMember.update({
      where: { id: guestMember.id },
      data: {
        status: "RESTRICTED",
        statusReason: "GROUP_DOWNGRADED",
        restrictedAt: new Date(),
        endedAt: null,
        version: { increment: 1 }
      }
    });

    const guestAfterRestricted = await requestData<GetCurrentDiningGroupContextResponse>("/dining-groups/current", {
      headers: { authorization: guestAuthorization }
    });
    const guestEntitlementsAfterRestricted = await requestData<EffectiveEntitlementSnapshot>("/entitlements/current", {
      headers: { authorization: guestAuthorization }
    });
    const guestAdminEntitlementsAfterRestricted = await requestData<AdminUserEntitlementResponse>(
      `/admin/user-entitlements?userId=${guestUser.id}`,
      {
        headers: { authorization: adminAuthorization, ...adminHeaders }
      }
    );
    assert(guestAfterRestricted.currentSpace.myStatus === "RESTRICTED", "restricted member status was not returned");
    assert(guestAfterRestricted.currentSpace.memberCount === 2, "restricted member should still count toward memberCount");
    assert(
      guestEntitlementsAfterRestricted.currentScope === "DINING_GROUP",
      "restricted member should keep dining-group entitlement scope"
    );
    assert(
      guestAdminEntitlementsAfterRestricted.entitlements.currentScope === "DINING_GROUP",
      "admin entitlement query should keep restricted member in dining-group scope"
    );

    const fullInvite = await request<CreateInviteResult>("/dining-group-invites", {
      method: "POST",
      headers: { authorization: ownerAuthorization },
      body: JSON.stringify({ diningGroupId, operationId: randomUUID() })
    });
    assert(fullInvite.status === 400, "free dining group should reject new invites at the two-member limit");

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

    const snapshotId = leave1.carryBackSnapshot?.id;
    assert(snapshotId, "leave did not return a carry-back snapshot id");
    await assertDbRejected("deleted snapshot should not allow invalidatedAt at the same time", () =>
      prisma.carryBackSnapshot.update({
        where: { id: snapshotId },
        data: {
          status: "DELETED",
          deletedAt: new Date(),
          invalidatedAt: new Date()
        }
      })
    );
    const guestSnapshots = await requestData<GetCarryBackSnapshotsResponse>("/carry-back-snapshots", {
      headers: { authorization: guestAuthorization }
    });
    assert(guestSnapshots.snapshots.some(snapshot => snapshot.id === snapshotId), "guest cannot list the new snapshot");
    assert(
      guestSnapshots.snapshots.every((snapshot, index, list) => {
        return index === 0 || Date.parse(list[index - 1].createdAt) >= Date.parse(snapshot.createdAt);
      }),
      "carry-back snapshots are not sorted by createdAt descending"
    );

    const ownerSnapshots = await requestData<GetCarryBackSnapshotsResponse>("/carry-back-snapshots", {
      headers: { authorization: ownerAuthorization }
    });
    assert(!ownerSnapshots.snapshots.some(snapshot => snapshot.id === snapshotId), "snapshot leaked to another user");

    const listedSnapshot = await prisma.carryBackSnapshot.findUniqueOrThrow({ where: { id: snapshotId } });
    const expiredAt = new Date(Date.now() - 1_000);
    await prisma.carryBackSnapshot.update({
      where: { id: snapshotId },
      data: { createdAt: new Date(expiredAt.getTime() - 1_000), expiresAt: expiredAt }
    });
    const expiredSnapshots = await requestData<GetCarryBackSnapshotsResponse>("/carry-back-snapshots", {
      headers: { authorization: guestAuthorization }
    });
    assert(!expiredSnapshots.snapshots.some(snapshot => snapshot.id === snapshotId), "expired snapshot was listed");

    await prisma.carryBackSnapshot.update({
      where: { id: snapshotId },
      data: { status: "INVALIDATED", expiresAt: listedSnapshot.expiresAt, invalidatedAt: new Date() }
    });
    const invalidSnapshots = await requestData<GetCarryBackSnapshotsResponse>("/carry-back-snapshots", {
      headers: { authorization: guestAuthorization }
    });
    assert(!invalidSnapshots.snapshots.some(snapshot => snapshot.id === snapshotId), "invalidated snapshot was listed");

    await prisma.carryBackSnapshot.update({
      where: { id: snapshotId },
      data: { status: "DELETED", invalidatedAt: null, deletedAt: new Date() }
    });
    const deletedSnapshots = await requestData<GetCarryBackSnapshotsResponse>("/carry-back-snapshots", {
      headers: { authorization: guestAuthorization }
    });
    assert(!deletedSnapshots.snapshots.some(snapshot => snapshot.id === snapshotId), "deleted snapshot was listed");

    const restoredSnapshot = await prisma.carryBackSnapshot.update({
      where: { id: snapshotId },
      data: {
        status: "AVAILABLE",
        createdAt: listedSnapshot.createdAt,
        expiresAt: listedSnapshot.expiresAt,
        invalidatedAt: null,
        deletedAt: null
      }
    });
    await requestData<GetCarryBackSnapshotsResponse>("/carry-back-snapshots", {
      headers: { authorization: guestAuthorization }
    });
    const snapshotAfterRead = await prisma.carryBackSnapshot.findUniqueOrThrow({ where: { id: snapshotId } });
    assert(snapshotAfterRead.updatedAt.getTime() === restoredSnapshot.updatedAt.getTime(), "snapshot list wrote to the database");
    await requestData<GetCurrentDiningGroupContextResponse>("/dining-groups/current", {
      headers: { authorization: guestAuthorization }
    });
    const snapshotAfterCurrent = await prisma.carryBackSnapshot.findUniqueOrThrow({ where: { id: snapshotId } });
    assert(snapshotAfterCurrent.updatedAt.getTime() === restoredSnapshot.updatedAt.getTime(), "current endpoint wrote to the snapshot");

    const guestMemberAfterLeave = await prisma.diningGroupMember.findUnique({
      where: { diningGroupId_userId: { diningGroupId, userId: guestUser.id } }
    });
    assert(guestMemberAfterLeave?.status === "ENDED", "guest membership was not ended");
    assert(guestMemberAfterLeave.statusReason === "LEFT", "guest membership end reason mismatch");

    const guestAfterLeave = await requestData<GetCurrentDiningGroupContextResponse>("/dining-groups/current", {
      headers: { authorization: guestAuthorization }
    });
    assertCurrentShape(guestAfterLeave, "null");
    assert(guestAfterLeave.currentSpace.id === guestBefore.currentSpace.id, "current endpoint did not restore solo space");
    assert(guestAfterLeave.originalSpace === null, "restored user should not expose a frozen original space");

    const adminDiningGroupsAfterLeave = await requestData<PageResult<AdminDiningGroupSummary>>("/admin/dining-groups?page=1&pageSize=100", {
      headers: { authorization: adminAuthorization, ...adminHeaders }
    });
    const restoredGroup = adminDiningGroupsAfterLeave.items.find(item => item.id === diningGroupId);
    assert(restoredGroup?.memberCount === 1, "admin dining group memberCount should drop after leave");

    const invalid = await request("/dining-group-invites/not-a-real-token/accept", {
      method: "POST",
      headers: { authorization: guestAuthorization },
      body: JSON.stringify({ operationId: randomUUID() })
    });
    assert(invalid.status === 400, "invalid invite token should return 400");

    const unauthenticated = await request<GetCurrentDiningGroupContextResponse>("/dining-groups/current");
    assert(unauthenticated.status === 401, "unauthenticated current space should return 401");
    const unauthenticatedEntitlements = await request<EffectiveEntitlementSnapshot>("/entitlements/current");
    assert(unauthenticatedEntitlements.status === 401, "unauthenticated entitlement request should return 401");
    const unauthenticatedStorage = await request<StorageUsageSummary>("/storage-usage");
    assert(unauthenticatedStorage.status === 401, "unauthenticated storage request should return 401");
    const unauthenticatedSnapshots = await request<GetCarryBackSnapshotsResponse>("/carry-back-snapshots");
    assert(unauthenticatedSnapshots.status === 401, "unauthenticated snapshot request should return 401");

    console.log(
      JSON.stringify(
        {
          apiBaseUrl,
          diningGroupId,
          ownerUid: ownerLogin.user.uid,
          guestUid: guestLogin.user.uid,
          createInviteIdempotent: true,
          acceptInviteIdempotent: true,
          acceptInviteConflictStatus: conflictingAcceptInvite.status,
          inviteConsumedOnce: true,
          originalSpaceFrozen: true,
          freeMemberLimitEnforced: true,
          leaveIdempotent: true,
          originalSpaceRestored: true,
          carryBackSnapshotCreated: true,
          carryBackSnapshotListPrivate: true,
          carryBackSnapshotFiltersApplied: true,
          carryBackSnapshotListReadOnly: true,
          entitlementEndpointConsistent: true,
          storageUsageEndpointConsistent: true,
          invalidInviteStatus: invalid.status,
          unauthenticatedStatus: unauthenticated.status,
          unauthenticatedEntitlementStatus: unauthenticatedEntitlements.status,
          unauthenticatedStorageStatus: unauthenticatedStorage.status,
          unauthenticatedSnapshotStatus: unauthenticatedSnapshots.status
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
