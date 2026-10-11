import { PrismaClient } from "@prisma/client";
import { loadLocalEnv } from "../src/common/load-env";

loadLocalEnv();

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL 未配置，停止只读审计");

const databaseHost = new URL(databaseUrl).hostname;
if (!["localhost", "127.0.0.1", "::1"].includes(databaseHost)) {
  throw new Error("只允许对本地数据库运行此只读审计");
}

const prisma = new PrismaClient();

async function main() {
  const report = await prisma.$transaction(async tx => {
    await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
    const [summary] = await tx.$queryRaw<Array<Record<string, unknown>>>`
      WITH legacy AS (
        SELECT
          r.id AS recipe_id,
          r.owner_id,
          r.origin_version_id,
          r.current_version_id,
          r.cover_image_url,
          r.origin_cover_image_url,
          r.created_at,
          r.updated_at,
          COUNT(source.id)::int AS source_candidate_count,
          MIN(source.id) AS only_source_recipe_id,
          BOOL_OR(source.is_inspiration) AS has_current_inspiration_source
        FROM recipes r
        LEFT JOIN recipes source
          ON source.current_version_id = r.origin_version_id
         AND source.id <> r.id
         AND source.is_inspiration = TRUE
        WHERE r.origin_version_id IS NOT NULL
          AND r.is_inspiration = FALSE
        GROUP BY r.id
      ),
      refs AS (
        SELECT l.recipe_id, 'meal_plan_dishes'::text AS reference_type, COUNT(*)::int AS reference_count
        FROM legacy l
        JOIN meal_plan_dishes d
          ON d.recipe_id = l.recipe_id OR d.recipe_version_id IN (l.current_version_id, l.origin_version_id)
        GROUP BY l.recipe_id
        UNION ALL
        SELECT l.recipe_id, 'dining_event_participant_bring_recipes', COUNT(*)::int
        FROM legacy l
        JOIN dining_event_participant_bring_recipes d
          ON d.recipe_id = l.recipe_id OR d.recipe_version_id IN (l.current_version_id, l.origin_version_id)
        GROUP BY l.recipe_id
        UNION ALL
        SELECT l.recipe_id, 'dining_event_wish_items', COUNT(*)::int
        FROM legacy l
        JOIN dining_event_wish_items d
          ON d.recipe_id = l.recipe_id OR d.recipe_version_id IN (l.current_version_id, l.origin_version_id)
        GROUP BY l.recipe_id
        UNION ALL
        SELECT l.recipe_id, 'dining_event_menu_items', COUNT(*)::int
        FROM legacy l
        JOIN dining_event_menu_items d ON d.recipe_version_id IN (l.current_version_id, l.origin_version_id)
        GROUP BY l.recipe_id
        UNION ALL
        SELECT l.recipe_id, 'shopping_items', COUNT(*)::int
        FROM legacy l
        JOIN shopping_items d
          ON d.source_recipe_id = l.recipe_id OR d.source_recipe_version_id IN (l.current_version_id, l.origin_version_id)
        GROUP BY l.recipe_id
      ),
      ref_totals AS (
        SELECT recipe_id, SUM(reference_count)::int AS fixed_reference_count,
          jsonb_object_agg(reference_type, reference_count) AS references_by_type
        FROM refs
        GROUP BY recipe_id
      ),
      collection_summary AS (
        SELECT COUNT(*)::int AS rows,
          COUNT(DISTINCT user_id || ':' || source_recipe_id)::int AS distinct_user_recipe_holders,
          COUNT(DISTINCT source_recipe_id)::int AS source_recipes,
          COUNT(DISTINCT user_id)::int AS users,
          COUNT(DISTINCT source_version_id)::int AS source_versions
        FROM recipe_collections
      ),
      collection_count_comparison AS (
        SELECT COUNT(*) FILTER (WHERE r.collect_count <> COALESCE(c.actual_count, 0))::int AS recipes_with_stale_collect_count,
          COALESCE(SUM(ABS(r.collect_count - COALESCE(c.actual_count, 0))), 0)::int AS total_absolute_count_delta
        FROM recipes r
        LEFT JOIN (
          SELECT source_recipe_id, COUNT(DISTINCT user_id)::int AS actual_count
          FROM recipe_collections
          GROUP BY source_recipe_id
        ) c ON c.source_recipe_id = r.id
        WHERE r.is_inspiration = TRUE
      )
      SELECT
        (SELECT jsonb_build_object(
          'legacyCopyCount', COUNT(*),
          'uniqueCurrentSourceCandidateCount', COUNT(*) FILTER (WHERE source_candidate_count = 1),
          'ambiguousCurrentSourceCandidateCount', COUNT(*) FILTER (WHERE source_candidate_count > 1),
          'noCurrentSourceCandidateCount', COUNT(*) FILTER (WHERE source_candidate_count = 0),
          'unchangedCopyCount', COUNT(*) FILTER (
            WHERE current_version_id = origin_version_id
              AND cover_image_url IS NOT DISTINCT FROM origin_cover_image_url
          ),
          'changedBodyOrCoverCount', COUNT(*) FILTER (
            WHERE current_version_id <> origin_version_id
               OR cover_image_url IS DISTINCT FROM origin_cover_image_url
          ),
          'copiesWithFixedReferences', COUNT(*) FILTER (WHERE COALESCE(refs.fixed_reference_count, 0) > 0),
          'totalFixedReferences', COALESCE(SUM(refs.fixed_reference_count), 0),
          'ownersWithCopies', COUNT(DISTINCT owner_id)
        ) FROM legacy l LEFT JOIN ref_totals refs ON refs.recipe_id = l.recipe_id) AS legacy_copies,
        (SELECT to_jsonb(collection_summary) FROM collection_summary) AS existing_collections,
        (SELECT to_jsonb(collection_count_comparison) FROM collection_count_comparison) AS collect_count_comparison,
        (SELECT COALESCE(jsonb_agg(jsonb_build_object(
          'recipeId', l.recipe_id,
          'ownerId', l.owner_id,
          'originVersionId', l.origin_version_id,
          'currentVersionId', l.current_version_id,
          'sourceCandidateCount', l.source_candidate_count,
          'sourceRecipeId', CASE WHEN l.source_candidate_count = 1 THEN l.only_source_recipe_id END,
          'contentUnchanged', l.current_version_id = l.origin_version_id,
          'coverUnchanged', l.cover_image_url IS NOT DISTINCT FROM l.origin_cover_image_url,
          'fixedReferenceCount', COALESCE(refs.fixed_reference_count, 0),
          'referencesByType', COALESCE(refs.references_by_type, '{}'::jsonb),
          'createdAt', l.created_at
        ) ORDER BY l.recipe_id), '[]'::jsonb) FROM legacy l LEFT JOIN ref_totals refs ON refs.recipe_id = l.recipe_id) AS legacy_copy_rows
    `;
    return summary;
  }, { timeout: 30_000 });

  console.log(JSON.stringify(report, null, 2));
}

main()
  .catch(error => {
    console.error(error instanceof Error ? error.message : "只读审计失败");
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
