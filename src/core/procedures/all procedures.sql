CREATE POLICY "Enable read access for all users" ON "storage"."objects"
AS PERMISSIVE FOR SELECT
TO public
USING (true);

CREATE POLICY "Enable insert for all users" ON "storage"."objects"
AS PERMISSIVE FOR INSERT
TO public
WITH CHECK (true);

CREATE POLICY "Enable update for all users" ON "storage"."objects"
AS PERMISSIVE FOR UPDATE
TO public
USING (true)
WITH CHECK (true);

CREATE POLICY "Enable delete for all users" ON "storage"."objects"
AS PERMISSIVE FOR DELETE
TO public
USING (true);

CREATE POLICY "Enable read access for all users" ON "storage"."buckets"
AS PERMISSIVE FOR SELECT
TO public
USING (true);

CREATE POLICY "Enable insert for all users " ON "storage"."buckets"
AS PERMISSIVE FOR INSERT
TO public
WITH CHECK (true);

CREATE POLICY "Enable update for all users" ON "storage"."buckets"
AS PERMISSIVE FOR UPDATE
TO public
USING (true)
WITH CHECK (true);

CREATE POLICY "Enable delete for all users" ON "storage"."buckets"
AS PERMISSIVE FOR DELETE
TO public
USING (true);


alter table promotion_rule
add column id_text text generated always as (id::text) stored;

create or replace function delete_group_if_no_bundle(_group_id integer)
returns json
language plpgsql
as $$
declare
  conflicting_bundles json;
begin
  -- Get all bundles associated via bundle_tag → tag → group
 select json_agg(json_build_object(
  'bundle_id', b.id,
  'bundle_name', b.data->>'display_title'
)) into conflicting_bundles
from bundle_tag bt
join tag t on t.id = bt.tag_id
join bundle b on b.id = bt.bundle_id
where t.tag_group_id = _group_id;

  -- If bundles are found, return error
  if conflicting_bundles is not null then
    return json_build_object(
      'error', 'Cannot delete group: some tags are associated with bundles',
      'code', 500,
      'bundles', conflicting_bundles
    );
  end if;

  -- Safe to delete group
  delete from tag_group where id = _group_id;

  return json_build_object('success', true);
exception
  when others then
    return json_build_object('error', sqlerrm, 'code', 500);
end;
$$;


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
CREATE OR REPLACE FUNCTION export_referrals_data(
  p_user_id UUID DEFAULT NULL,
  p_search TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_user_id UUID := NULLIF(p_user_id::text, '')::uuid;
  v_total INT;
  v_data JSON;
BEGIN
  -- Count total records (only successful orders)
  SELECT COUNT(*) INTO v_total
  FROM user_order o
  INNER JOIN promotion_usage pu 
    ON o.id = pu.order_id
  WHERE (v_user_id IS NULL OR o.user_id = v_user_id)
    AND o.referral_code IS NOT NULL
    AND o.order_status = 'success'
    AND (p_search IS NULL OR o.referral_code ILIKE '%' || p_search || '%');

  -- Get ALL data (only successful orders)
  SELECT json_agg(t) INTO v_data
  FROM (
    SELECT
      o.id,
      o.created_at,
      o.user_id,
      o.referral_code,
      o.payment_time,
      o.currency,
      o.modified_amount,
      o.order_status,
      pu.status,
      pu.amount AS amount,
      pu.referred_to,
      u.email AS user_email   -- only email of pu.user_id
    FROM
      user_order o
      INNER JOIN promotion_usage pu 
        ON o.id = pu.order_id
      INNER JOIN users_copy u 
        ON u.id = pu.user_id
    WHERE
      (v_user_id IS NULL OR o.user_id = v_user_id)
      AND o.referral_code IS NOT NULL
      AND o.order_status = 'success'
      AND (p_search IS NULL OR o.referral_code ILIKE '%' || p_search || '%')
    ORDER BY o.created_at DESC
  ) t;

  RETURN json_build_object(
    'total', v_total,
    'count', COALESCE(json_array_length(v_data), 0),
    'referrals', COALESCE(v_data, '[]'::json)
  );
END;
$$ LANGUAGE plpgsql;
create or replace function export_user_data(p_user_id uuid)
returns json as $$
declare
  v_devices json;
  v_referrals json;
  v_wallet json;
begin
  -- Devices
  select json_agg(d) into v_devices
  from (
    select * from device where user_id = p_user_id order by created_at desc
  ) d;

  -- Referrals
  select get_referral_transactions_with_count(p_user_id, 1000000, 0)->'data'
  into v_referrals;

  -- Wallet Transactions
  select get_wallet_transactions_with_count(p_user_id, 1000000, 0)->'data'
  into v_wallet;

  -- Final JSON output
  return json_build_object(
    'devices', coalesce(v_devices, '[]'::json),
    'referrals', coalesce(v_referrals, '[]'::json),
    'wallet_transactions', coalesce(v_wallet, '[]'::json)
  );
end;
$$ language plpgsql;
CREATE OR REPLACE FUNCTION get_referral_transactions_with_count(
  p_user_id UUID DEFAULT NULL,
  p_limit INT DEFAULT 10,
  p_offset INT DEFAULT 0,
  p_search TEXT DEFAULT NULL,
  p_from_email TEXT DEFAULT NULL,
  p_referral_date DATE DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_total INT;
  v_data JSON;
BEGIN
  -- Count total records (only successful orders)
  SELECT COUNT(*) INTO v_total
  FROM user_order o
  INNER JOIN promotion_usage pu 
    ON o.id = pu.order_id
  WHERE (p_user_id IS NULL OR o.user_id = p_user_id)
    AND o.referral_code IS NOT NULL
    AND o.order_status = 'success'
    AND (p_search IS NULL OR o.referral_code ILIKE '%' || p_search || '%')
    AND (p_from_email IS NULL OR pu.referred_to ILIKE '%' || p_from_email || '%')
    AND (p_referral_date IS NULL OR o.created_at::date = p_referral_date);

  -- Get paginated data (only successful orders)
  SELECT json_agg(t) INTO v_data
  FROM (
    SELECT
      o.id,
      o.created_at,
      o.user_id,
      o.referral_code,
      o.payment_time,
      o.currency,
      o.modified_amount,
      o.order_status,
      pu.status,
      pu.amount AS amount,
      pu.referred_to,
      u.email AS user_email   -- only email for pu.user_id
    FROM
      user_order o
      INNER JOIN promotion_usage pu 
        ON o.id = pu.order_id
      INNER JOIN users_copy u 
        ON u.id = pu.user_id
    WHERE
      (p_user_id IS NULL OR o.user_id = p_user_id)
      AND o.referral_code IS NOT NULL
      AND o.order_status = 'success'
      AND (p_search IS NULL OR o.referral_code ILIKE '%' || p_search || '%')
      AND (p_from_email IS NULL OR pu.referred_to ILIKE '%' || p_from_email || '%')
      AND (p_referral_date IS NULL OR o.created_at::date = p_referral_date)
    ORDER BY o.created_at DESC
    LIMIT p_limit OFFSET p_offset
  ) t;

  -- Return final JSON
  RETURN json_build_object(
    'total', v_total,
    'count', COALESCE(json_array_length(v_data), 0),
    'data', COALESCE(v_data, '[]'::json)
  );
END;
$$ LANGUAGE plpgsql;
create or replace function get_tags_with_group_all(
  search text,
  page integer,
  page_size integer
)
returns json
language sql
as $$
  select json_build_object(
    'total', (
      select count(*)
      from tag t
      join tag_group tg on tg.id = t.tag_group_id
      where t.name ilike '%' || search || '%'
    ),
    'items', (
      select json_agg(item)
      from (
        select
          t.id,
          t.name || ' (' || tg.name || ')' as title
        from tag t
        join tag_group tg on tg.id = t.tag_group_id
        where t.name ilike '%' || search || '%'
        order by t.name
        limit page_size
        offset (page - 1) * page_size
      ) as item
    )
  );
$$;
create or replace function get_wallet_transactions_with_count(
  p_user_id uuid default null,
  p_limit int default 10,
  p_offset int default 0
)
returns json as $$
declare
  v_total int;
  v_data json;
begin
  -- Count total
  select count(*) into v_total
  from user_wallet_transaction as uwt
  inner join user_wallet as uw on uw.id = uwt.wallet_id
  where p_user_id is null or uw.user_id = p_user_id;

  -- Fetch paginated data
  select json_agg(t) into v_data
  from (
    select 
      uwt.id,
      uwt.wallet_id,
      uwt.amount,
      uwt.status,
      uwt.source,
      uw.currency,
      uwt.created_at
    from user_wallet_transaction as uwt
    inner join user_wallet as uw on uw.id = uwt.wallet_id
    where p_user_id is null or uw.user_id = p_user_id
    order by uwt.created_at desc
    limit p_limit offset p_offset
  ) t;

  return json_build_object(
    'total', v_total,
    'count', coalesce(json_array_length(v_data), 0),
    'data', coalesce(v_data, '[]'::json)
  );
end;
$$ language plpgsql;
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


-- NOTE : without this constraint the assign bundle to group will not work

ALTER TABLE tag
ADD CONSTRAINT unique_tag_name_per_group
UNIQUE (name, tag_group_id);

-- Create or replace the trigger function
CREATE OR REPLACE FUNCTION update_promotion_rule_name()
RETURNS TRIGGER AS $$
DECLARE
  action_name TEXT;
  event_name TEXT;
BEGIN
  SELECT name INTO action_name FROM promotion_rule_action WHERE id = NEW.promotion_rule_action_id;
  SELECT name INTO event_name FROM promotion_rule_event WHERE id = NEW.promotion_rule_event_id;

  NEW.name := action_name || '-' || event_name || '-' || NEW.max_usage::text;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger on promotion_rule table
DROP TRIGGER IF EXISTS trg_update_promotion_rule_name ON promotion_rule;

CREATE TRIGGER trg_update_promotion_rule_name
BEFORE INSERT OR UPDATE ON promotion_rule
FOR EACH ROW
EXECUTE FUNCTION update_promotion_rule_name();


CREATE OR REPLACE FUNCTION validate_bundle_codes()
RETURNS TRIGGER AS $$
DECLARE
    code TEXT;
    exists_count INT;
BEGIN
    -- Only validate if bundle_code is NOT NULL and NOT empty
    IF NEW.bundle_code IS NULL OR trim(NEW.bundle_code) = '' THEN
        RETURN NEW;
    END IF;

    -- Split bundle_code string into array
    FOREACH code IN ARRAY string_to_array(NEW.bundle_code, ',')
    LOOP
        SELECT COUNT(*) INTO exists_count
        FROM bundle
        WHERE data->>'bundle_code' = trim(code);

        IF exists_count = 0 THEN
            RAISE EXCEPTION 'Invalid bundle code: %', code;
        END IF;
    END LOOP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_bundle_codes_promo_trigger
BEFORE INSERT OR UPDATE ON promotion
FOR EACH ROW
EXECUTE FUNCTION validate_bundle_codes();


/*
  # Activate All Bundles  (TEOS-64)

  1. Function Purpose
     - Atomically sets is_active = TRUE on every bundle that is not active
     - Already active bundles are left untouched
     - Returns only the affected ids plus the before/after status, which is all
       the caller needs to write a compact audit_log entry

  2. Parameters
     - None. Unlike the deactivation, the reason is optional here, so there is
       nothing to validate; the reason is stored in audit_log by the caller
       (src/core/apis/bundlesAPI.jsx)

  3. Return Value
     - Success : { "success": true, "rows_affected": <int>,
                   "affected_bundle_ids": [...],
                   "old_status": "inactive", "new_status": "active",
                   "message": "..." }
     - No-op   : { "success": false, "rows_affected": 0,
                   "message": "All bundles are already active." }
     - Failure : { "error": "..." }  -- surfaced by src/core/apis/apiInstance.jsx

  4. Notes
     - SECURITY INVOKER (default): runs with the caller's rights and respects RLS
     - Authorization (super admin only), the audit_log entry and the
       APP_CACHE_KEY rotation are handled on the client side
     - A single bundle is toggled straight through supabase from the client
       (toggleBundleStatus in src/core/apis/bundlesAPI.jsx), no procedure needed
*/

CREATE OR REPLACE FUNCTION activate_all_bundles()
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
  v_ids   JSONB;
  v_count INTEGER;
BEGIN
  -- IS NOT TRUE also picks up bundles whose is_active was never set.
  WITH updated AS (
    UPDATE public.bundle
       SET is_active = TRUE
     WHERE is_active IS NOT TRUE
    RETURNING id
  )
  SELECT
    COALESCE(jsonb_agg(id ORDER BY id), '[]'::jsonb),
    COUNT(*)::int
  INTO v_ids, v_count
  FROM updated;

  IF v_count = 0 THEN
    RETURN json_build_object(
      'success',       FALSE,
      'rows_affected', 0,
      'message',       'All bundles are already active.'
    );
  END IF;

  RETURN json_build_object(
    'success',             TRUE,
    'rows_affected',       v_count,
    'affected_bundle_ids', v_ids,
    'old_status',          'inactive',
    'new_status',          'active',
    'message',             format(
      'All bundles have been successfully activated. %s bundle(s) affected.',
      v_count
    )
  );

exception
  when others then
    raise notice 'Rollback due to error: %', sqlerrm;
    -- No need for explicit ROLLBACK; PostgreSQL will auto-rollback the function on exception
    return json_build_object('error', sqlerrm);
END;
$$;

REVOKE ALL ON FUNCTION activate_all_bundles() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION activate_all_bundles() TO authenticated;


/*
  # Deactivate All Bundles  (TEOS-64)

  1. Function Purpose
     - Atomically sets is_active = FALSE on every currently active bundle
     - Already inactive bundles are left untouched
     - Returns only the affected ids plus the before/after status, which is all
       the caller needs to write a compact audit_log entry

  2. Parameters
     - p_reason: Mandatory reason, cannot be only spaces. Validated here as a
       backstop for the UI rule; the reason itself is stored in audit_log by
       the caller (src/core/apis/bundlesAPI.jsx)

  3. Return Value
     - Success : { "success": true, "rows_affected": <int>,
                   "affected_bundle_ids": [...],
                   "old_status": "active", "new_status": "inactive",
                   "message": "..." }
     - No-op   : { "success": false, "rows_affected": 0, "message": "..." }
     - Failure : { "error": "..." }  -- surfaced by src/core/apis/apiInstance.jsx

  4. Notes
     - SECURITY INVOKER (default): runs with the caller's rights and respects RLS
     - Authorization (super admin only), the audit_log entry and the
       APP_CACHE_KEY rotation are handled on the client side
*/

CREATE OR REPLACE FUNCTION deactivate_all_bundles(p_reason TEXT)
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
  v_reason TEXT := btrim(COALESCE(p_reason, ''));
  v_ids    JSONB;
  v_count  INTEGER;
BEGIN
  IF v_reason = '' THEN
    RETURN json_build_object(
      'error', 'A reason is required to deactivate all bundles.'
    );
  END IF;

  -- The WHERE clause is what keeps already inactive bundles unchanged.
  WITH updated AS (
    UPDATE public.bundle
       SET is_active = FALSE
     WHERE is_active IS TRUE
    RETURNING id
  )
  SELECT
    COALESCE(jsonb_agg(id ORDER BY id), '[]'::jsonb),
    COUNT(*)::int
  INTO v_ids, v_count
  FROM updated;

  IF v_count = 0 THEN
    RETURN json_build_object(
      'success',       FALSE,
      'rows_affected', 0,
      'message',       'All bundles are already inactive.'
    );
  END IF;

  RETURN json_build_object(
    'success',             TRUE,
    'rows_affected',       v_count,
    'affected_bundle_ids', v_ids,
    'old_status',          'active',
    'new_status',          'inactive',
    'message',             format(
      'All active bundles have been successfully deactivated. %s bundle(s) affected.',
      v_count
    )
  );

exception
  when others then
    raise notice 'Rollback due to error: %', sqlerrm;
    -- No need for explicit ROLLBACK; PostgreSQL will auto-rollback the function on exception
    return json_build_object('error', sqlerrm);
END;
$$;

REVOKE ALL ON FUNCTION deactivate_all_bundles(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION deactivate_all_bundles(TEXT) TO authenticated;


/*
  # Client IP Address  (TEOS-64)

  1. Function Purpose
     - Resolves the IP address of the caller so audit_log entries can record it
     - The browser cannot read its own public IP, but PostgREST exposes the
       incoming request headers, so the value is read server side instead

  2. Parameters
     - None

  3. Return Value
     - The client IP as text, or NULL when it cannot be determined.
       NULL is a valid answer: AC6 asks for the IP "when available"

  4. Resolution Order
     - cf-connecting-ip, then x-real-ip, then the first entry of
       x-forwarded-for, then the raw connection address
*/

CREATE OR REPLACE FUNCTION get_client_ip_address()
RETURNS TEXT
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_headers JSONB;
  v_ip      TEXT;
BEGIN
  v_headers := NULLIF(current_setting('request.headers', TRUE), '')::jsonb;

  v_ip := COALESCE(
    v_headers ->> 'cf-connecting-ip',
    v_headers ->> 'x-real-ip',
    NULLIF(split_part(COALESCE(v_headers ->> 'x-forwarded-for', ''), ',', 1), '')
  );

  v_ip := NULLIF(btrim(COALESCE(v_ip, '')), '');

  RETURN COALESCE(v_ip, host(inet_client_addr()));

exception
  when others then
    -- Never let IP resolution break the operation being audited.
    return null;
END;
$$;

REVOKE ALL ON FUNCTION get_client_ip_address() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_client_ip_address() TO authenticated;


/*
  # audit_log.operation_details  (TEOS-64)

  Adds the column the bulk bundle actions use to store the extra context of an
  operation, next to the existing old_data / new_data columns.

  Written by src/core/apis/bundlesAPI.jsx as, for example:
    { "reason": "...", "ip_address": "1.2.3.4", "rows_affected": 12 }

  Idempotent - safe to re-run.
*/

ALTER TABLE public.audit_log
  ADD COLUMN IF NOT EXISTS operation_details JSONB;
