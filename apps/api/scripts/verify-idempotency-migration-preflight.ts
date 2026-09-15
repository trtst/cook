import { Prisma, PrismaClient } from "@prisma/client";
import { loadLocalEnv } from "../src/common/load-env";

export const idempotencyDuplicateScopes = ["user-no-group", "user-group", "admin"] as const;
export type IdempotencyDuplicateScope = (typeof idempotencyDuplicateScopes)[number];

export type IdempotencyDuplicate = {
  operationId: string;
  operationType: string;
  userId?: number;
  diningGroupId?: number;
  adminId?: number;
  duplicateCount: number;
};

export type IdempotencyDuplicateAudit = {
  scope: IdempotencyDuplicateScope;
  duplicates: IdempotencyDuplicate[];
};

export interface IdempotencyDuplicateRepository {
  findDuplicates(scope: IdempotencyDuplicateScope): Promise<IdempotencyDuplicate[]>;
}

export async function auditIdempotencyRecordDuplicates(repository: IdempotencyDuplicateRepository): Promise<IdempotencyDuplicateAudit[]> {
  return Promise.all(idempotencyDuplicateScopes.map(async scope => ({
    scope,
    duplicates: await repository.findDuplicates(scope)
  })));
}

export function assertNoIdempotencyRecordDuplicates(audit: IdempotencyDuplicateAudit[]) {
  const conflicts = audit.filter(item => item.duplicates.length > 0);
  if (conflicts.length > 0) {
    throw new Error(`idempotency migration preflight failed: ${JSON.stringify(conflicts)}`);
  }
}

const duplicateQueries: Record<IdempotencyDuplicateScope, Prisma.Sql> = {
  "user-no-group": Prisma.sql`
    SELECT "operation_id" AS "operationId", "operation_type" AS "operationType", "user_id" AS "userId", COUNT(*)::INTEGER AS "duplicateCount"
    FROM "idempotency_records"
    WHERE "user_id" IS NOT NULL AND "dining_group_id" IS NULL AND "admin_id" IS NULL
    GROUP BY "operation_id", "operation_type", "user_id"
    HAVING COUNT(*) > 1
    ORDER BY "operation_id", "operation_type", "user_id"
  `,
  "user-group": Prisma.sql`
    SELECT "operation_id" AS "operationId", "operation_type" AS "operationType", "user_id" AS "userId", "dining_group_id" AS "diningGroupId", COUNT(*)::INTEGER AS "duplicateCount"
    FROM "idempotency_records"
    WHERE "user_id" IS NOT NULL AND "dining_group_id" IS NOT NULL AND "admin_id" IS NULL
    GROUP BY "operation_id", "operation_type", "user_id", "dining_group_id"
    HAVING COUNT(*) > 1
    ORDER BY "operation_id", "operation_type", "user_id", "dining_group_id"
  `,
  admin: Prisma.sql`
    SELECT "operation_id" AS "operationId", "operation_type" AS "operationType", "admin_id" AS "adminId", COUNT(*)::INTEGER AS "duplicateCount"
    FROM "idempotency_records"
    WHERE "admin_id" IS NOT NULL AND "user_id" IS NULL AND "dining_group_id" IS NULL
    GROUP BY "operation_id", "operation_type", "admin_id"
    HAVING COUNT(*) > 1
    ORDER BY "operation_id", "operation_type", "admin_id"
  `
};

function prismaRepository(client: PrismaClient): IdempotencyDuplicateRepository {
  return {
    findDuplicates: scope => client.$queryRaw<IdempotencyDuplicate[]>(duplicateQueries[scope])
  };
}

export async function main() {
  loadLocalEnv();
  const client = new PrismaClient();
  try {
    const audit = await auditIdempotencyRecordDuplicates(prismaRepository(client));
    assertNoIdempotencyRecordDuplicates(audit);
    console.log(JSON.stringify(audit, null, 2));
  } finally {
    await client.$disconnect();
  }
}

if (require.main === module) {
  void main();
}
