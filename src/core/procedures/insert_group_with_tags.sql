create or replace function insert_group_with_tags(
  _name text,
  _group_category text,
  _type integer,
  _tags jsonb
)
returns json
language plpgsql
as $$
declare
  inserted_group tag_group;
  tag jsonb;
begin
  insert into tag_group (name, group_category, type)
  values (_name, _group_category, _type)
  returning * into inserted_group;

  -- Insert tags
  for tag in select * from jsonb_array_elements(_tags)
  loop
    insert into tag (id, name, icon, tag_group_id, data)
    values (
   (tag->>'id')::uuid,          -- assuming id is UUID
    tag->>'name',
    tag->>'icon',
    inserted_group.id,
    tag->'data'   
    );
  end loop;

  return json_build_object('group', inserted_group);

exception
  when others then
    raise notice 'Rollback due to error: %', sqlerrm;
    -- No need for explicit ROLLBACK; PostgreSQL will auto-rollback the function on exception
    return json_build_object('error', sqlerrm);
end;
$$;
