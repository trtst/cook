-- Remove legacy "not at home" states as well as the older traces they superseded.
-- Only identities whose latest state is MANUAL_EMPTY are affected; positive or
-- unknown identities and shopping-list rows remain untouched.
WITH latest AS (
  SELECT DISTINCT ON (
    user_id,
    CASE
      WHEN ingredient_id IS NULL THEN 'name:' || LOWER(BTRIM(name))
      ELSE 'ingredient:' || ingredient_id::text
    END
  )
    user_id,
    ingredient_id,
    LOWER(BTRIM(name)) AS normalized_name,
    kind
  FROM fridge_traces
  ORDER BY
    user_id,
    CASE
      WHEN ingredient_id IS NULL THEN 'name:' || LOWER(BTRIM(name))
      ELSE 'ingredient:' || ingredient_id::text
    END,
    created_at DESC,
    id DESC
), empty_identities AS (
  SELECT user_id, ingredient_id, normalized_name
  FROM latest
  WHERE kind = 'MANUAL_EMPTY'
)
DELETE FROM fridge_traces AS trace
USING empty_identities AS empty
WHERE trace.user_id = empty.user_id
  AND (
    (empty.ingredient_id IS NOT NULL AND trace.ingredient_id = empty.ingredient_id)
    OR (
      empty.ingredient_id IS NULL
      AND trace.ingredient_id IS NULL
      AND LOWER(BTRIM(trace.name)) = empty.normalized_name
    )
  );
