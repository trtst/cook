-- Keep resource IDs in the documented ranges after explicit seed inserts.
-- Sequence values are table-local; IDs do not need to be globally unique across tables.

SELECT setval(pg_get_serial_sequence('public.recipe_categories', 'id'), GREATEST(COALESCE((SELECT MAX("id") FROM "recipe_categories"), 0), 9999999), true);
SELECT setval(pg_get_serial_sequence('public.recipe_scenes', 'id'), GREATEST(COALESCE((SELECT MAX("id") FROM "recipe_scenes"), 0), 9999999), true);
SELECT setval(pg_get_serial_sequence('public.inspiration_categories', 'id'), GREATEST(COALESCE((SELECT MAX("id") FROM "inspiration_categories"), 0), 6000), true);
SELECT setval(pg_get_serial_sequence('public.ingredient_categories', 'id'), GREATEST(COALESCE((SELECT MAX("id") FROM "ingredient_categories"), 0), 5000), true);
SELECT setval(pg_get_serial_sequence('public.units', 'id'), GREATEST(COALESCE((SELECT MAX("id") FROM "units"), 0), 3000), true);
SELECT setval(pg_get_serial_sequence('public.ingredients', 'id'), GREATEST(COALESCE((SELECT MAX("id") FROM "ingredients"), 0), 9999999), true);
SELECT setval(pg_get_serial_sequence('public.recipe_content_versions', 'id'), GREATEST(COALESCE((SELECT MAX("id") FROM "recipe_content_versions"), 0), 9999999), true);
SELECT setval(pg_get_serial_sequence('public.recipes', 'id'), GREATEST(COALESCE((SELECT MAX("id") FROM "recipes"), 0), 9999999), true);
