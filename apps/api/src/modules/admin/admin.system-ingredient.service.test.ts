import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { hashIdempotencyRequest } from "../../common/idempotency";
import { AdminService } from "./admin.service";

const mergeMigrationPath = resolve(
  process.cwd(),
  "prisma/migrations/20260915233000_system_ingredient_merge/migration.sql"
);

test("lists pending system ingredients for the unclassified category", async () => {
  let listWhere: unknown;
  const service = new AdminService(
    {
      adminAccount: {
        findUnique: async () => ({ status: "ACTIVE", roles: ["SUPER_ADMIN"] })
      },
      ingredient: {
        findMany: async ({ where }: { where: unknown }) => {
          listWhere = where;
          return [{
            id: 10000001,
            name: "荠菜",
            version: 1,
            status: "PENDING",
            categoryId: 5009,
            category: { name: "待归类" },
            defaultUnit: null,
            proteinType: null,
            isStaple: false,
            isSpicyIngredient: false,
            aliases: [],
            imageUpdatedAt: null,
            updatedAt: new Date("2026-09-14T00:00:00.000Z")
          }];
        },
        count: async () => 1
      },
      $transaction: async (operations: Array<Promise<unknown>>) => Promise.all(operations)
    } as never,
    {} as never,
    {} as never,
    {} as never,
    { buildImageUrl: () => null } as never,
    {} as never
  );

  const result = await service.listIngredients({}, 1, 20, 5009, undefined, "PENDING", "ALL", 1);

  assert.deepEqual(listWhere, {
    ownerId: null,
    status: "PENDING",
    categoryId: 5009
  });
  assert.equal(result.items[0]?.status, "PENDING");
  assert.equal(result.items[0]?.defaultUnit, null);
});

test("includes pending ingredients when an unclassified category requests all statuses", async () => {
  let listWhere: unknown;
  const service = new AdminService(
    {
      adminAccount: {
        findUnique: async () => ({ status: "ACTIVE", roles: ["SUPER_ADMIN"] })
      },
      ingredient: {
        findMany: async ({ where }: { where: unknown }) => {
          listWhere = where;
          return [];
        },
        count: async () => 0
      },
      $transaction: async (operations: Array<Promise<unknown>>) => Promise.all(operations)
    } as never,
    {} as never,
    {} as never,
    {} as never,
    { buildImageUrl: () => null } as never,
    {} as never
  );

  await service.listIngredients({}, 1, 20, 5009, undefined, "ALL", "ALL", 1);

  assert.deepEqual(listWhere, {
    ownerId: null,
    status: { in: ["PENDING", "ACTIVE", "DISABLED", "MERGED"] },
    categoryId: 5009
  });
});

test("includes pending ingredients in the unclassified category count", async () => {
  const service = new AdminService(
    {
      adminAccount: {
        findUnique: async () => ({ status: "ACTIVE", roles: ["SUPER_ADMIN"] })
      },
      ingredientCategory: {
        findMany: async () => [{
          id: 5009,
          code: "UNCLASSIFIED",
          name: "待归类",
          isSelectable: false,
          version: 1,
          updatedAt: new Date("2026-09-14T00:00:00.000Z")
        }]
      },
      ingredient: {
        groupBy: async ({ where }: { where: { status: unknown } }) =>
          where.status === "PENDING"
            ? [{ categoryId: 5009, _count: { _all: 6 } }]
            : [{ categoryId: 5009, _count: { _all: 2 } }]
      }
    } as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never
  );

  const result = await service.listIngredientCategories(undefined, 1);

  assert.equal(result[0]?.ingredientCount, 8);
});

test("reactivating an ingredient without a default unit returns a business error before the database check", async () => {
  const tx = {
    $queryRaw: async () => undefined,
    idempotencyRecord: {
      findFirst: async () => null,
      create: async () => ({}),
      updateMany: async () => ({ count: 1 })
    },
    ingredient: {
      findFirst: async () => ({ systemSortOrder: 0, displaySortOrder: 0 }),
      update: async () => {
        throw new Error("ingredients_active_default_unit_check");
      }
    }
  };
  const service = new AdminService(
    {
      $transaction: async (work: (transaction: typeof tx) => Promise<unknown>) => work(tx)
    } as never,
    {} as never,
    {} as never,
    {} as never,
    { buildImageUrl: () => null } as never,
    {} as never
  );
  (service as any).requireSuperAdmin = async () => undefined;
  (service as any).requireSystemIngredient = async () => ({
    id: 10000001,
    name: "缺单位食材",
    version: 1,
    status: "DISABLED",
    categoryId: 5009,
    category: { id: 5009, name: "待归类" },
    defaultUnitId: null,
    defaultUnit: null,
    proteinType: null,
    isStaple: false,
    isSpicyIngredient: false,
    aliases: [],
    imageUpdatedAt: null,
    updatedAt: new Date("2026-09-15T00:00:00.000Z")
  });

  await assert.rejects(
    service.setIngredientStatus(
      {},
      10000001,
      { operationId: "90001", expectedVersion: 1, status: "ACTIVE" },
      1
    ),
    /缺少默认单位，请先补充后再上架/
  );
});

test("does not disable an active ingredient that is still a merge target", async () => {
  const lockedIngredientIds: number[] = [];
  let updated = false;
  const ingredient = {
    id: 10000001,
    name: "茄子",
    version: 7,
    status: "ACTIVE",
    categoryId: 5001,
    category: { id: 5001, name: "蔬果菌菇" },
    defaultUnitId: 3001,
    defaultUnit: { id: 3001, name: "克", type: "WEIGHT", source: "SYSTEM" },
    mergedTo: null,
    proteinType: null,
    isStaple: false,
    isSpicyIngredient: false,
    aliases: [],
    imageUpdatedAt: null,
    updatedAt: new Date("2026-09-15T00:00:00.000Z")
  };
  const tx = {
    $queryRaw: async (...args: unknown[]) => {
      if (typeof args[1] === "number") lockedIngredientIds.push(args[1]);
      return [];
    },
    idempotencyRecord: {
      findFirst: async () => null,
      create: async () => undefined,
      updateMany: async () => ({ count: 1 })
    },
    ingredient: {
      count: async () => 1,
      update: async () => {
        updated = true;
        return { ...ingredient, status: "DISABLED", version: 8 };
      }
    },
    auditEvent: { create: async () => undefined }
  };
  const service = new AdminService(
    { $transaction: async (work: (transaction: typeof tx) => Promise<unknown>) => work(tx) } as never,
    {} as never,
    {} as never,
    {} as never,
    { buildImageUrl: () => null } as never,
    {} as never
  );
  (service as any).requireSuperAdmin = async () => undefined;
  (service as any).requireSystemIngredient = async () => ingredient;

  await assert.rejects(
    service.setIngredientStatus(
      {},
      ingredient.id,
      { operationId: "90002", expectedVersion: ingredient.version, status: "DISABLED" },
      1
    ),
    /仍是归并主食材/
  );
  assert.deepEqual(lockedIngredientIds, [ingredient.id]);
  assert.equal(updated, false);
});

test("lists merged system ingredients with their active target", async () => {
  let listWhere: unknown;
  let listInclude: unknown;
  const service = new AdminService(
    {
      adminAccount: {
        findUnique: async () => ({ status: "ACTIVE", roles: ["SUPER_ADMIN"] })
      },
      ingredient: {
        findMany: async ({ where, include }: { where: unknown; include: unknown }) => {
          listWhere = where;
          listInclude = include;
          return [{
            id: 10000024,
            name: "长茄子",
            version: 4,
            status: "MERGED",
            categoryId: 5001,
            category: { name: "蔬果菌菇" },
            defaultUnit: { id: 3001, name: "克", type: "WEIGHT", source: "SYSTEM" },
            mergedTo: { id: 10000001, name: "茄子" },
            proteinType: null,
            isStaple: false,
            isSpicyIngredient: false,
            aliases: [],
            imageUpdatedAt: null,
            updatedAt: new Date("2026-09-15T12:00:00.000Z")
          }];
        },
        count: async () => 1
      },
      $transaction: async (operations: Array<Promise<unknown>>) => Promise.all(operations)
    } as never,
    {} as never,
    {} as never,
    {} as never,
    { buildImageUrl: () => null } as never,
    {} as never
  );

  const result = await service.listIngredients({}, 1, 20, undefined, undefined, "MERGED", "ALL", 1);

  assert.deepEqual(listWhere, { ownerId: null, status: "MERGED" });
  assert.deepEqual(listInclude, { category: true, defaultUnit: true, mergedTo: { select: { id: true, name: true } } });
  assert.equal(result.items[0]?.status, "MERGED");
  assert.deepEqual(result.items[0]?.mergedTo, { id: 10000001, name: "茄子" });
});

test("the all-status ingredient query includes merged governance rows", async () => {
  let listWhere: unknown;
  const service = new AdminService(
    {
      adminAccount: {
        findUnique: async () => ({ status: "ACTIVE", roles: ["SUPER_ADMIN"] })
      },
      ingredient: {
        findMany: async ({ where }: { where: unknown }) => {
          listWhere = where;
          return [];
        },
        count: async () => 0
      },
      $transaction: async (operations: Array<Promise<unknown>>) => Promise.all(operations)
    } as never,
    {} as never,
    {} as never,
    {} as never,
    { buildImageUrl: () => null } as never,
    {} as never
  );

  await service.listIngredients({}, 1, 20, undefined, undefined, "ALL", "ALL", 1);

  assert.deepEqual(listWhere, {
    ownerId: null,
    status: { in: ["PENDING", "ACTIVE", "DISABLED", "MERGED"] }
  });
});

test("system ingredient governance counts retain merged rows", async () => {
  let governedWhere: unknown;
  const service = new AdminService(
    {
      adminAccount: {
        findUnique: async () => ({ status: "ACTIVE", roles: ["SUPER_ADMIN"] })
      },
      ingredientCategory: {
        findMany: async () => [{
          id: 5001,
          code: "PRODUCE",
          name: "蔬果菌菇",
          isSelectable: true,
          version: 1,
          updatedAt: new Date("2026-09-15T00:00:00.000Z")
        }]
      },
      ingredient: {
        groupBy: async ({ where }: { where: unknown }) => {
          governedWhere = where;
          return [{ categoryId: 5001, _count: { _all: 3 } }];
        }
      }
    } as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never
  );

  const result = await service.listIngredientCategories(undefined, 1);

  assert.deepEqual(governedWhere, {
    ownerId: null,
    status: { in: ["ACTIVE", "DISABLED", "MERGED"] },
    categoryId: { in: [5001] }
  });
  assert.equal(result[0]?.ingredientCount, 3);
});

test("the merge migration rejects malformed relationships and enforces row invariants", () => {
  assert.equal(existsSync(mergeMigrationPath), true);
  const migration = existsSync(mergeMigrationPath) ? readFileSync(mergeMigrationPath, "utf8") : "";

  assert.match(migration, /Invalid ingredient merge relationship/);
  assert.match(migration, /ingredients_merge_state_check/);
  assert.match(migration, /\("status" = 'MERGED'\) = \("merged_to_id" IS NOT NULL\)/);
  assert.match(migration, /ingredients_merge_not_self_check/);
  assert.match(migration, /"merged_to_id" IS NULL OR "merged_to_id" <> "id"/);
});

test("merges a system ingredient and repoints mutable references in one transaction", async () => {
  const ingredientUpdates: Array<{ where: unknown; data: unknown }> = [];
  const fridgeUpdates: Array<{ where: unknown; data: unknown }> = [];
  const shoppingUpdates: Array<{ where: unknown; data: unknown }> = [];
  const audits: Array<Record<string, unknown>> = [];
  const lockedIngredientIds: number[] = [];
  const tx = {
    $queryRaw: async (...args: unknown[]) => {
      if (typeof args[1] === "number") lockedIngredientIds.push(args[1]);
      return [];
    },
    idempotencyRecord: {
      findFirst: async () => null,
      create: async () => ({ id: 1 }),
      updateMany: async () => ({ count: 1 })
    },
    ingredient: {
      findFirst: async ({ where }: { where: { id: number } }) => {
        if (where.id === 10000024) {
          return {
            id: 10000024,
            ownerId: null,
            name: "长茄子",
            version: 3,
            status: "ACTIVE",
            categoryId: 5001,
            category: { id: 5001, name: "蔬果菌菇", code: "PRODUCE" },
            defaultUnit: { id: 3001, name: "克", type: "WEIGHT", source: "SYSTEM" }
          };
        }
        return {
          id: 10000001,
          ownerId: null,
          name: "茄子",
          version: 7,
          status: "ACTIVE",
          categoryId: 5001,
          category: { id: 5001, name: "蔬果菌菇", code: "PRODUCE" },
          defaultUnit: { id: 3001, name: "克", type: "WEIGHT", source: "SYSTEM" }
        };
      },
      findMany: async ({ where }: { where: Record<string, unknown> }) =>
        where.mergedToId === 10000024 ? [{ id: 10000025 }] : [],
      updateMany: async (args: { where: unknown; data: unknown }) => {
        ingredientUpdates.push(args);
        return { count: 1 };
      }
    },
    fridgeItem: {
      updateMany: async (args: { where: unknown; data: unknown }) => {
        fridgeUpdates.push(args);
        return { count: 2 };
      }
    },
    shoppingItem: {
      updateMany: async (args: { where: unknown; data: unknown }) => {
        shoppingUpdates.push(args);
        return { count: 3 };
      }
    },
    recipeImportItem: {
      findMany: async () => []
    },
    auditEvent: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        audits.push(data);
        return data;
      }
    }
  };
  const service = new AdminService(
    {
      $transaction: async (work: (transaction: typeof tx) => Promise<unknown>) => work(tx)
    } as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never
  );
  (service as any).requireSuperAdmin = async () => undefined;

  const result = await (service as any).mergeIngredient(
    10000024,
    { operationId: "92001", expectedVersion: 3, targetIngredientId: 10000001 },
    1
  );

  assert.equal(result.sourceIngredientId, 10000024);
  assert.equal(result.targetIngredientId, 10000001);
  assert.match(result.mergedAt, /^2026-|^2027-/);
  assert.deepEqual(lockedIngredientIds, [10000001, 10000024]);
  assert.deepEqual(ingredientUpdates, [
    {
      where: { id: 10000025, status: "MERGED", mergedToId: 10000024 },
      data: { mergedToId: 10000001, version: { increment: 1 } }
    },
    {
      where: { id: 10000024, ownerId: null, version: 3, status: "ACTIVE" },
      data: { status: "MERGED", mergedToId: 10000001, version: { increment: 1 } }
    }
  ]);
  assert.deepEqual(fridgeUpdates, [{
    where: { ingredientId: { in: [10000024, 10000025] } },
    data: { ingredientId: 10000001 }
  }]);
  assert.deepEqual(shoppingUpdates, [{
    where: { ingredientId: { in: [10000024, 10000025] } },
    data: { ingredientId: 10000001 }
  }]);
  assert.equal(audits[0]?.action, "INGREDIENT_MERGED");
  assert.deepEqual(audits[0]?.payload, {
    sourceStatus: "ACTIVE",
    targetIngredientId: 10000001,
    repointedCount: 1,
    fridgeCount: 2,
    shoppingCount: 3,
    importItemCount: 0
  });
});

test("rejects invalid ingredient merge source and target states before mutation", async () => {
  const cases = [
    {
      name: "stale source version",
      source: { id: 10000024, ownerId: null, version: 4, status: "ACTIVE" },
      target: { id: 10000001, ownerId: null, version: 1, status: "ACTIVE" },
      sourceId: 10000024,
      targetId: 10000001,
      expectedVersion: 3,
      message: /食材已被更新/
    },
    {
      name: "pending source",
      source: { id: 10000024, ownerId: null, version: 3, status: "PENDING" },
      target: { id: 10000001, ownerId: null, version: 1, status: "ACTIVE" },
      sourceId: 10000024,
      targetId: 10000001,
      expectedVersion: 3,
      message: /只有启用中或已下架/
    },
    {
      name: "personal source",
      source: { id: 10000024, ownerId: 7, version: 3, status: "ACTIVE" },
      target: { id: 10000001, ownerId: null, version: 1, status: "ACTIVE" },
      sourceId: 10000024,
      targetId: 10000001,
      expectedVersion: 3,
      message: /来源系统食材不存在/
    },
    {
      name: "personal target",
      source: { id: 10000024, ownerId: null, version: 3, status: "ACTIVE" },
      target: { id: 10000001, ownerId: 7, version: 1, status: "ACTIVE" },
      sourceId: 10000024,
      targetId: 10000001,
      expectedVersion: 3,
      message: /目标系统食材不存在或未启用/
    },
    {
      name: "disabled target",
      source: { id: 10000024, ownerId: null, version: 3, status: "ACTIVE" },
      target: { id: 10000001, ownerId: null, version: 1, status: "DISABLED" },
      sourceId: 10000024,
      targetId: 10000001,
      expectedVersion: 3,
      message: /目标系统食材不存在或未启用/
    }
  ];

  for (const scenario of cases) {
    let mutated = false;
    const tx = {
      $queryRaw: async () => [],
      idempotencyRecord: {
        findFirst: async () => null,
        create: async () => undefined
      },
      ingredient: {
        findFirst: async ({ where }: { where: { id: number; ownerId?: null; status?: string } }) => {
          const row = where.id === scenario.source.id ? scenario.source : scenario.target;
          if (where.ownerId === null && row.ownerId !== null) return null;
          if (where.status && row.status !== where.status) return null;
          return row;
        },
        findMany: async () => {
          mutated = true;
          return [];
        },
        updateMany: async () => {
          mutated = true;
          return { count: 1 };
        }
      }
    };
    const service = new AdminService(
      { $transaction: async (work: (transaction: typeof tx) => Promise<unknown>) => work(tx) } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never
    );
    (service as any).requireSuperAdmin = async () => undefined;

    await assert.rejects(
      (service as any).mergeIngredient(
        scenario.sourceId,
        {
          operationId: `9300${cases.indexOf(scenario)}`,
          expectedVersion: scenario.expectedVersion,
          targetIngredientId: scenario.targetId
        },
        1
      ),
      scenario.message,
      scenario.name
    );
    assert.equal(mutated, false, scenario.name);
  }

  const service = new AdminService({} as never, {} as never, {} as never, {} as never, {} as never, {} as never);
  (service as any).requireSuperAdmin = async () => undefined;
  await assert.rejects(
    (service as any).mergeIngredient(
      10000024,
      { operationId: "93009", expectedVersion: 3, targetIngredientId: 10000024 },
      1
    ),
    /来源食材和主食材不能相同/
  );
});

test("returns the stored merge result for an idempotent retry without mutations", async () => {
  const requestHash = JSON.stringify({
    sourceIngredientId: 10000024,
    expectedVersion: 3,
    targetIngredientId: 10000001
  });
  const storedResult = {
    sourceIngredientId: 10000024,
    targetIngredientId: 10000001,
    mergedAt: "2026-09-15T12:00:00.000Z"
  };
  let queriedIngredient = false;
  const tx = {
    $queryRaw: async () => [],
    idempotencyRecord: {
      findFirst: async () => ({
        requestHash: hashIdempotencyRequest(requestHash),
        status: "SUCCEEDED",
        resultJson: storedResult
      })
    },
    ingredient: {
      findFirst: async () => {
        queriedIngredient = true;
        return null;
      }
    }
  };
  const service = new AdminService(
    { $transaction: async (work: (transaction: typeof tx) => Promise<unknown>) => work(tx) } as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never
  );
  (service as any).requireSuperAdmin = async () => undefined;

  const result = await (service as any).mergeIngredient(
    10000024,
    { operationId: "92001", expectedVersion: 3, targetIngredientId: 10000001 },
    1
  );

  assert.deepEqual(result, storedResult);
  assert.equal(queriedIngredient, false);
});

test("allows a disabled system ingredient to become a merged lookup item", async () => {
  const ingredientUpdates: Array<{ where: Record<string, unknown>; data: Record<string, unknown> }> = [];
  const source = {
    id: 10000024,
    ownerId: null,
    name: "长茄子",
    version: 3,
    status: "DISABLED",
    category: { code: "PRODUCE" },
    defaultUnit: { id: 3001, name: "克" }
  };
  const target = {
    id: 10000001,
    ownerId: null,
    name: "茄子",
    version: 7,
    status: "ACTIVE",
    category: { code: "PRODUCE" },
    defaultUnit: { id: 3001, name: "克" }
  };
  const tx = {
    $queryRaw: async () => [],
    idempotencyRecord: {
      findFirst: async () => null,
      create: async () => undefined,
      updateMany: async () => ({ count: 1 })
    },
    ingredient: {
      findFirst: async ({ where }: { where: { id: number } }) => where.id === source.id ? source : target,
      findMany: async () => [],
      updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
        ingredientUpdates.push({ where, data });
        return { count: 1 };
      }
    },
    fridgeItem: { updateMany: async () => ({ count: 0 }) },
    shoppingItem: { updateMany: async () => ({ count: 0 }) },
    recipeImportItem: { findMany: async () => [] },
    auditEvent: { create: async () => undefined }
  };
  const service = new AdminService(
    { $transaction: async (work: (transaction: typeof tx) => Promise<unknown>) => work(tx) } as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never
  );
  (service as any).requireSuperAdmin = async () => undefined;

  await (service as any).mergeIngredient(
    source.id,
    { operationId: "94001", expectedVersion: source.version, targetIngredientId: target.id },
    1
  );

  assert.deepEqual(ingredientUpdates[0], {
    where: { id: source.id, ownerId: null, version: source.version, status: "DISABLED" },
    data: { status: "MERGED", mergedToId: target.id, version: { increment: 1 } }
  });
});
