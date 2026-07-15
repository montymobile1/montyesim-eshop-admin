create or replace function edit_tag_group(
  p_id integer,
  p_name text,
  p_type integer,
  p_group_category text,
  p_new_tags jsonb,
  p_updated_tags jsonb,
  p_deleted_tag_ids uuid[]
)
returns void
language plpgsql
as $$
begin
  -- Step 1: Update the tag group
  update tag_group
  set name = p_name,
      type = p_type,
      group_category = p_group_category
  where id = p_id;

  -- Step 2: Delete tags by IDs
  -- tag_translation rows are removed via the tag_id FK (cascade) or below.
  if array_length(p_deleted_tag_ids, 1) is not null then
    delete from tag_translation
    where tag_id = any(p_deleted_tag_ids);

    delete from tag
    where id = any(p_deleted_tag_ids);
  end if;

  -- Step 3: Insert new tags
  insert into tag (id, name, icon, tag_group_id, data)
select
    (t->>'tag_id')::uuid,  -- id from JSON
    t->>'name',             -- name
    t->>'icon',             -- icon
    p_id,                   -- tag_group_id
    t->'data'               -- JSON object stored in 'data' column
  from jsonb_array_elements(p_new_tags) as t;

  -- Step 4: Update existing tags
  update tag
  set
    name = t.value->>'name',
    icon = t.value->>'icon',
    data = t.value->'data'   -- JSON object stored in 'data' column (e.g. alternative_country)
  from jsonb_array_elements(p_updated_tags) with ordinality as t(value, idx)
  where tag.id::text = t.value->>'id';

  -- Step 4b: Keep tag_translation in sync for every locale of the updated tags
  update tag_translation tt
  set
    data = t.value->'data'
  from jsonb_array_elements(p_updated_tags) as t(value)
  where tt.tag_id::text = t.value->>'id';

end;
$$;
