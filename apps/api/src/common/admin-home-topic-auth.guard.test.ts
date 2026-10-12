import assert from "node:assert/strict";
import test from "node:test";
import { ForbiddenException, UnauthorizedException, type ExecutionContext } from "@nestjs/common";
import { AdminAuthGuard } from "./admin-auth.guard";
import { SuperAdminGuard } from "./super-admin.guard";

function contextFor(request: object) {
  return {
    switchToHttp: () => ({ getRequest: () => request })
  } as unknown as ExecutionContext;
}

test("AdminAuthGuard rejects requests without a Bearer token", async () => {
  let databaseReads = 0;
  const guard = new AdminAuthGuard(
    { verifyToken: () => ({ sub: 7, roles: ["SUPER_ADMIN"] }) } as never,
    { adminAccount: { findUnique: async () => { databaseReads += 1; return { status: "ACTIVE", roles: ["SUPER_ADMIN"] }; } } } as never
  );

  await assert.rejects(guard.canActivate(contextFor({ headers: { authorization: "Basic credentials" } })), UnauthorizedException);
  assert.equal(databaseReads, 0);
});

test("SuperAdminGuard uses the admin's current database roles, not token claims", async () => {
  const request: Record<string, unknown> = { headers: { authorization: "Bearer signed-token" } };
  const authGuard = new AdminAuthGuard(
    { verifyToken: () => ({ sub: 7, roles: ["SUPER_ADMIN"] }) } as never,
    { adminAccount: { findUnique: async () => ({ status: "ACTIVE", roles: ["CONTENT_ADMIN"] }) } } as never
  );

  await authGuard.canActivate(contextFor(request));
  assert.deepEqual(request.admin, { adminId: 7, roles: ["CONTENT_ADMIN"] });
  assert.throws(() => new SuperAdminGuard().canActivate(contextFor(request)), ForbiddenException);
});

test("SuperAdminGuard allows an active admin with the SUPER_ADMIN role", async () => {
  const request: Record<string, unknown> = { headers: { authorization: "Bearer signed-token" } };
  const authGuard = new AdminAuthGuard(
    { verifyToken: () => ({ sub: 7, roles: ["CONTENT_ADMIN"] }) } as never,
    { adminAccount: { findUnique: async () => ({ status: "ACTIVE", roles: ["SUPER_ADMIN"] }) } } as never
  );

  await authGuard.canActivate(contextFor(request));
  assert.equal(new SuperAdminGuard().canActivate(contextFor(request)), true);
});
