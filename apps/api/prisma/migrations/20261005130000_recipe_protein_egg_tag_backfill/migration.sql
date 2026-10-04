-- Correct legacy AUTO/NONE tags only when the first structured main-protein
-- ingredient is explicitly classified as EGG. Human and ambiguous tags remain untouched.
UPDATE "recipe_version_tags" AS tag
SET "tag_value" = 'EGG',
    "updated_at" = CURRENT_TIMESTAMP
FROM "recipe_content_versions" AS version
WHERE tag."recipe_version_id" = version."id"
  AND tag."tag_code" = 'MAIN_PROTEIN_TYPE'
  AND tag."tag_value" = 'NONE'
  AND tag."source" = 'AUTO'
  AND EXISTS (
    SELECT 1
    FROM "recipes" AS current_recipe
    WHERE current_recipe."current_version_id" = version."id"
      AND current_recipe."status" = 'ACTIVE'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM "recipe_version_tags" AS manual_tag
    WHERE manual_tag."recipe_version_id" = version."id"
      AND manual_tag."tag_code" = 'MAIN_PROTEIN_TYPE'
      AND manual_tag."source" <> 'AUTO'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM "recipe_version_tags" AS egg_tag
    WHERE egg_tag."recipe_version_id" = version."id"
      AND egg_tag."tag_code" = 'MAIN_PROTEIN_TYPE'
      AND egg_tag."tag_value" = 'EGG'
      AND egg_tag."source" = 'AUTO'
  )
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(
      CASE
        WHEN jsonb_typeof(version."ingredients_json") = 'array' THEN version."ingredients_json"
        ELSE '[]'::jsonb
      END
    ) WITH ORDINALITY AS candidate(value, position)
    JOIN "ingredients" AS ingredient
      ON ingredient."id" = CASE
        WHEN candidate.value ->> 'ingredientId' ~ '^[0-9]+$'
          THEN (candidate.value ->> 'ingredientId')::integer
        ELSE NULL
      END
    JOIN "ingredient_categories" AS category
      ON category."id" = ingredient."category_id"
    WHERE category."code" IN ('MEAT_POULTRY_EGG', 'SEAFOOD')
      AND ingredient."protein_type" = 'EGG'
      AND NOT EXISTS (
        SELECT 1
        FROM jsonb_array_elements(
          CASE
            WHEN jsonb_typeof(version."ingredients_json") = 'array' THEN version."ingredients_json"
            ELSE '[]'::jsonb
          END
        ) WITH ORDINALITY AS previous(value, position)
        JOIN "ingredients" AS previous_ingredient
          ON previous_ingredient."id" = CASE
            WHEN previous.value ->> 'ingredientId' ~ '^[0-9]+$'
              THEN (previous.value ->> 'ingredientId')::integer
            ELSE NULL
          END
        JOIN "ingredient_categories" AS previous_category
          ON previous_category."id" = previous_ingredient."category_id"
        WHERE previous.position < candidate.position
          AND previous_category."code" IN ('MEAT_POULTRY_EGG', 'SEAFOOD')
          AND previous_ingredient."protein_type" IS NOT NULL
      )
  );
