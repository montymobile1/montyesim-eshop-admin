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
