import { PrismaClient } from "@prisma/client";
import { loadLocalEnv } from "../src/common/load-env";

loadLocalEnv();

const databaseUrl = process.env.DATABASE_URL;
const databaseHost = databaseUrl ? new URL(databaseUrl).hostname : "";
const prisma = new PrismaClient();

function readCount(name: string, fallback: number, maximum: number) {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isSafeInteger(value) || value < 1 || value > maximum) {
    throw new Error(`${name} must be an integer between 1 and ${maximum}`);
  }
  return value;
}

const candidates = readCount("BENCH_CANDIDATES", 10_000, 10_000);
const saves = readCount("BENCH_SAVES", 500_000, 500_000);
const planDishes = readCount("BENCH_PLAN_DISHES", 2_000_000, 2_000_000);
const repeats = readCount("BENCH_REPEATS", 5, 10);

const rankingSql = `
WITH candidate AS (
  SELECT r.id, r.recommendation_rank,
    COALESCE(r.inspiration_published_at, r.created_at) AS published_at
  FROM recipes r
  INNER JOIN recipe_content_versions cv ON cv.id = r.current_version_id
  WHERE r.is_inspiration = TRUE
    AND r.status = 'ACTIVE'
    AND r.inspiration_category_id IS NOT NULL
),
save_counts AS (
  SELECT c.source_recipe_id AS id, COUNT(DISTINCT c.user_id)::int AS save_users
  FROM recipe_collections c
  INNER JOIN candidate r ON r.id = c.source_recipe_id
  WHERE c.created_at >= NOW() - INTERVAL '30 days'
  GROUP BY c.source_recipe_id
),
plan_user_counts AS (
  SELECT d.recipe_id AS id, p.user_id, LEAST(COUNT(*), 3)::int AS capped_adds
  FROM meal_plan_dishes d
  INNER JOIN meal_plan_items p ON p.id = d.plan_item_id
  INNER JOIN candidate r ON r.id = d.recipe_id
  WHERE d.created_at >= NOW() - INTERVAL '30 days'
    AND p.status <> 'CANCELLED'
  GROUP BY d.recipe_id, p.user_id
),
plan_counts AS (
  SELECT id, SUM(capped_adds)::int AS plan_adds
  FROM plan_user_counts
  GROUP BY id
),
scored AS (
  SELECT candidate.id, candidate.recommendation_rank, candidate.published_at,
    LN(1.0 + COALESCE(saves.save_users, 0))
      + 2.0 * LN(1.0 + COALESCE(plans.plan_adds, 0)) AS behavior_score,
    (recommendation_rank = 'NORMAL' AND published_at >= NOW() - INTERVAL '7 days') AS is_trial
  FROM candidate
  LEFT JOIN save_counts saves ON saves.id = candidate.id
  LEFT JOIN plan_counts plans ON plans.id = candidate.id
),
selected_trial AS (
  SELECT id FROM scored
  WHERE is_trial
  ORDER BY behavior_score DESC, published_at DESC, id DESC
  LIMIT 1
),
ordered AS (
  SELECT s.id,
    ROW_NUMBER() OVER (
      ORDER BY
        CASE s.recommendation_rank
          WHEN 'NORMAL' THEN 0
          WHEN 'DOWNRANK' THEN 1
          WHEN 'STRONG_DOWNRANK' THEN 2
        END,
        s.behavior_score DESC,
        s.published_at DESC,
        s.id DESC
    ) AS position
  FROM scored s
  WHERE s.id <> COALESCE((SELECT id FROM selected_trial), -1)
),
trial_slot AS (
  SELECT id, LEAST(10, (SELECT COUNT(*) FROM ordered) + 1) AS position
  FROM selected_trial
),
final_order AS (
  SELECT o.id, o.position
  FROM ordered o
  WHERE o.position < COALESCE((SELECT position FROM trial_slot), 2147483647)
  UNION ALL
  SELECT id, position FROM trial_slot
  UNION ALL
  SELECT o.id, o.position + 1
  FROM ordered o
  WHERE o.position >= COALESCE((SELECT position FROM trial_slot), 2147483647)
)
SELECT id
FROM final_order
ORDER BY position
OFFSET 0
LIMIT 20`;

type ExplainRow = { "QUERY PLAN": Array<Record<string, any>> };

async function createFixtures(tx: Prisma.TransactionClient) {
  await tx.$executeRawUnsafe(`
    CREATE TEMP TABLE recipes (
      id integer PRIMARY KEY,
      recommendation_rank text NOT NULL,
      inspiration_published_at timestamptz NOT NULL,
      created_at timestamptz NOT NULL,
      is_inspiration boolean NOT NULL,
      status text NOT NULL,
      inspiration_category_id integer NOT NULL,
      current_version_id integer NOT NULL
    ) ON COMMIT DROP`);
  await tx.$executeRawUnsafe(`
    CREATE TEMP TABLE recipe_content_versions (id integer PRIMARY KEY) ON COMMIT DROP`);
  await tx.$executeRawUnsafe(`
    CREATE TEMP TABLE recipe_collections (
      user_id integer NOT NULL,
      source_recipe_id integer NOT NULL,
      created_at timestamptz NOT NULL
    ) ON COMMIT DROP`);
  await tx.$executeRawUnsafe(`
    CREATE TEMP TABLE meal_plan_items (
      id integer PRIMARY KEY,
      user_id integer NOT NULL,
      status text NOT NULL
    ) ON COMMIT DROP`);
  await tx.$executeRawUnsafe(`
    CREATE TEMP TABLE meal_plan_dishes (
      plan_item_id integer NOT NULL,
      recipe_id integer NOT NULL,
      created_at timestamptz NOT NULL
    ) ON COMMIT DROP`);

  await tx.$executeRawUnsafe(`
    INSERT INTO recipe_content_versions (id)
    SELECT i FROM generate_series(1, ${candidates}) AS i`);
  await tx.$executeRawUnsafe(`
    INSERT INTO recipes (
      id, recommendation_rank, inspiration_published_at, created_at,
      is_inspiration, status, inspiration_category_id, current_version_id
    )
    SELECT i,
      CASE WHEN i % 1000 = 0 THEN 'STRONG_DOWNRANK'
           WHEN i % 100 = 0 THEN 'DOWNRANK'
           ELSE 'NORMAL' END,
      NOW() - ((i % 30) * INTERVAL '1 day'),
      NOW() - ((i % 30) * INTERVAL '1 day'),
      TRUE, 'ACTIVE', 1, i
    FROM generate_series(1, ${candidates}) AS i`);
  await tx.$executeRawUnsafe(`
    INSERT INTO recipe_collections (user_id, source_recipe_id, created_at)
    SELECT ((g - 1) % ${candidates}) * 100 + ((g - 1) / ${candidates}) + 1,
      ((g - 1) % ${candidates}) + 1,
      NOW() - ((g % 60) * INTERVAL '1 day')
    FROM generate_series(1, ${saves}) AS g`);
  await tx.$executeRawUnsafe(`
    INSERT INTO meal_plan_items (id, user_id, status)
    SELECT g,
      (((g - 1) / 200) * 100) + (((g - 1) % 200) / 3) + 1,
      CASE WHEN g % 20 = 0 THEN 'CANCELLED' ELSE 'PLANNED' END
    FROM generate_series(1, ${planDishes}) AS g`);
  await tx.$executeRawUnsafe(`
    INSERT INTO meal_plan_dishes (plan_item_id, recipe_id, created_at)
    SELECT g, ((g - 1) / 200) + 1,
      NOW() - ((g % 60) * INTERVAL '1 day')
    FROM generate_series(1, ${planDishes}) AS g`);

  await tx.$executeRawUnsafe(`CREATE INDEX ON recipe_collections (source_recipe_id, created_at, user_id)`);
  await tx.$executeRawUnsafe(`CREATE INDEX ON meal_plan_dishes (recipe_id, created_at, plan_item_id)`);
  await tx.$executeRawUnsafe(`ANALYZE recipes`);
  await tx.$executeRawUnsafe(`ANALYZE recipe_content_versions`);
  await tx.$executeRawUnsafe(`ANALYZE recipe_collections`);
  await tx.$executeRawUnsafe(`ANALYZE meal_plan_items`);
  await tx.$executeRawUnsafe(`ANALYZE meal_plan_dishes`);
}

function summarizePlan(node: Record<string, any>) {
  const totals = { sharedHit: 0, sharedRead: 0, tempRead: 0, tempWritten: 0 };
  const visit = (item: Record<string, any>) => {
    totals.sharedHit += item["Shared Hit Blocks"] ?? 0;
    totals.sharedRead += item["Shared Read Blocks"] ?? 0;
    totals.tempRead += item["Temp Read Blocks"] ?? 0;
    totals.tempWritten += item["Temp Written Blocks"] ?? 0;
    for (const child of item.Plans ?? []) visit(child);
  };
  visit(node.Plan);
  return {
    planningMs: node["Planning Time"],
    executionMs: node["Execution Time"],
    ...totals
  };
}

async function main() {
  if (databaseHost !== "127.0.0.1" && databaseHost !== "localhost") {
    throw new Error("Refusing benchmark against a non-local DATABASE_URL");
  }

  const result = await prisma.$transaction(async tx => {
    const environment = await tx.$queryRaw<Array<Record<string, string>>>
      `SELECT version() AS postgres_version,
        current_setting('shared_buffers') AS shared_buffers,
        current_setting('work_mem') AS work_mem,
        current_setting('max_parallel_workers_per_gather') AS parallel_workers,
        current_setting('random_page_cost') AS random_page_cost`;

    await createFixtures(tx);
    const runs = [];
    for (let index = 0; index < repeats; index += 1) {
      const rows = await tx.$queryRawUnsafe<ExplainRow[]>(`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${rankingSql}`);
      runs.push(summarizePlan(rows[0]["QUERY PLAN"][0]));
    }

    return {
      result: "MEASURED_NOT_SLO_VERIFIED",
      fixture: { candidates, saves, planDishes },
      repeats,
      environment: environment[0],
      hardware: { platform: process.platform, arch: process.arch, cpuCount: require("node:os").cpus().length },
      runs
    };
  }, { maxWait: 30_000, timeout: 300_000 });

  console.log(JSON.stringify(result, null, 2));
}

void main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}).finally(async () => {
  await prisma.$disconnect();
});
