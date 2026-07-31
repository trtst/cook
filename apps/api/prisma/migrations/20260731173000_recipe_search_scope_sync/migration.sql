UPDATE "recipe_drafts" AS draft
SET "search_text" = trim(
  concat_ws(
    ' ',
    coalesce(draft."content_json" ->> 'name', ''),
    coalesce(draft."content_json" ->> 'story', ''),
    coalesce(
      (
        SELECT string_agg(trim(coalesce(item ->> 'name', '')), ' ')
        FROM jsonb_array_elements(coalesce(draft."content_json" -> 'ingredients', '[]'::jsonb)) AS item
        WHERE trim(coalesce(item ->> 'name', '')) <> ''
      ),
      ''
    )
  )
);
