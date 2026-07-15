-- Backfill: set data->'alternative_country' to a string holding
-- the country name in English (taken from the tag's own `name` column),
-- for all tags in the "Countries" tag_group (id = 1), only where it is
-- currently missing/empty.
--
-- The same value is mirrored into every tag_translation row of that tag,
-- keeping `tag_translation.data` in sync with `tag.data`.
--
-- Result example:  { ..., "alternative_country": "Syria" }
--
-- HOW TO USE
--   1. Run STEP 1 (dry-run SELECT) and eyeball the rows that would change.
--   2. Run STEP 2 (UPDATE) inside a transaction, then COMMIT / ROLLBACK.
--
-- `tag.data` / `tag_translation.data` are jsonb, so the merge below works directly.

-- ---------------------------------------------------------------------------
-- STEP 1 — DRY RUN: preview which tags would be backfilled and to what value
-- ---------------------------------------------------------------------------
select
  t.id,
  t.name                                              as current_tag_name,
  t.data->'alternative_country'                       as current_value,
  to_jsonb(t.name)                                    as new_value
from tag t
where t.tag_group_id = 1                          -- "Countries" group
  and (
    t.data->'alternative_country' is null
    or jsonb_typeof(t.data->'alternative_country') <> 'string'
    or t.data->>'alternative_country' = ''
  )
order by t.name;

-- STEP 1b — DRY RUN: preview the tag_translation rows that would be backfilled
select
  tt.id,
  tt.tag_id,
  tt.locale,
  t.name                                              as country_name,
  tt.data->'alternative_country'                      as current_value,
  to_jsonb(t.name)                                    as new_value
from tag_translation tt
join tag t on t.id = tt.tag_id
where t.tag_group_id = 1                          -- "Countries" group
  and (
    tt.data->'alternative_country' is null
    or jsonb_typeof(tt.data->'alternative_country') <> 'string'
    or tt.data->>'alternative_country' = ''
  )
order by t.name, tt.locale;

-- ---------------------------------------------------------------------------
-- STEP 2 — APPLY the backfill
-- ---------------------------------------------------------------------------
begin;

update tag t
set data =
  coalesce(t.data, '{}'::jsonb)
  || jsonb_build_object('alternative_country', t.name)
where t.tag_group_id = 1                          -- "Countries" group
  and (
    t.data->'alternative_country' is null
    or jsonb_typeof(t.data->'alternative_country') <> 'string'
    or t.data->>'alternative_country' = ''
  );

-- Step 2b — mirror the value into every tag_translation row of those tags,
-- using the country name from the parent tag (English `name`).
update tag_translation tt
set data =
  coalesce(tt.data, '{}'::jsonb)
  || jsonb_build_object('alternative_country', t.name)
from tag t
where t.id = tt.tag_id
  and t.tag_group_id = 1                          -- "Countries" group
  and (
    tt.data->'alternative_country' is null
    or jsonb_typeof(tt.data->'alternative_country') <> 'string'
    or tt.data->>'alternative_country' = ''
  );

-- Verify the affected rows, then decide:
--   COMMIT;    -- keep the changes
--   ROLLBACK;  -- discard the changes
commit;
