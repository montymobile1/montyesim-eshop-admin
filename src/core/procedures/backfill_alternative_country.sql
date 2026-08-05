-- Backfill: enrich `tag_translation.data` for every tag in the "Countries"
-- tag_group (id = 1) by merging in the identifying fields from the parent tag:
--   id, country_code, iso3_code, zone_name, and alternative_country
--   (the country name in English, taken from the tag's own `name` column).
--
-- Only tag_translation rows still missing any of id / country_code /
-- iso3_code / zone_name are touched.
--
-- Result example:
--   { ..., "id": 42, "country_code": "SY", "iso3_code": "SYR",
--          "zone_name": "Asia", "alternative_country": "Syria" }
--
-- HOW TO USE
--   1. Run STEP 1 (dry-run SELECT) and eyeball the rows that would change.
--   2. Run STEP 2 (UPDATE) inside a transaction, then COMMIT / ROLLBACK.
--
-- `tag.data` / `tag_translation.data` are jsonb, so the merge below works directly.

-- ---------------------------------------------------------------------------
-- STEP 1 — DRY RUN: preview the tag_translation rows that would be backfilled,
--          showing exactly the merged value STEP 2 will write.
-- ---------------------------------------------------------------------------
select
  tt.id,
  tt.tag_id,
  tt.locale,
  t.name                                              as country_name,
  tt.data                                             as current_value,
  coalesce(tt.data, '{}'::jsonb)
  || jsonb_build_object(
    'id', t.id,
    'country_code', t.data->>'country_code',
    'iso3_code', t.data->>'iso3_code',
    'zone_name', t.data->>'zone_name',
    'alternative_country', t.name
  )                                                   as new_value
from tag_translation tt
join tag t on t.id = tt.tag_id
where t.tag_group_id = 1                          -- "Countries" group
  and (
    tt.data->'id' is null
    or tt.data->'country_code' is null
    or tt.data->'iso3_code' is null
    or tt.data->'zone_name' is null
  )
order by t.name, tt.locale;

-- ---------------------------------------------------------------------------
-- STEP 2 — APPLY the backfill
-- ---------------------------------------------------------------------------
begin;

update tag_translation tt
set data =
  coalesce(tt.data, '{}'::jsonb)
  || jsonb_build_object(
    'id', t.id,
    'country_code', t.data->>'country_code',
    'iso3_code', t.data->>'iso3_code',
    'zone_name', t.data->>'zone_name',
    'alternative_country', t.name
  )
from tag t
where t.id = tt.tag_id
  and t.tag_group_id = 1
  and (
    tt.data->'id' is null
    or tt.data->'country_code' is null
    or tt.data->'iso3_code' is null
    or tt.data->'zone_name' is null
  );

select
  tt.id,
  tt.locale,
  tt.data
from tag_translation tt
join tag t on t.id = tt.tag_id
where t.tag_group_id = 1
  and (
    tt.data->'id' is null
    or tt.data->'country_code' is null
    or tt.data->'iso3_code' is null
    or tt.data->'zone_name' is null
  );

commit;